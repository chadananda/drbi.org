<script>
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let postid, sessionid, visible;
  let post = {};
  let EasyMDE, easyMDEInstance, textArea, hasUnsavedChanges = false, content = '';
  let timeoutId = null;

  // export let visible = true;
  // export let fullScreenMode = false; // Update this line

  $: if (easyMDEInstance) updateSaveButton(hasUnsavedChanges);
  // $: if (visible && easyMDEInstance && post) tick().then(() => easyMDEInstance.value(post.body));

  $: if (visible) tick().then(()=> loadPost());

  const updateSaveButton = (unsavedChanges) => {
    const saveButton = document.querySelector('.fa-save');
    if (saveButton) {
      saveButton.style.color = unsavedChanges ? 'green' : 'silver';
      saveButton.style.fontSize = unsavedChanges ? '24px' : '14px';
      saveButton.style.fontWeight = unsavedChanges ? 'bold' : 'inherit';
    }
  };

  const addCSS = () => {
    const link = document.createElement('link');
    link.href = 'https://unpkg.com/easymde/dist/easymde.min.css';
    link.type = 'text/css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  };

  const handleFullScreenChange = (isFullScreen) => {
    dispatch('fullScreenModeChanged', isFullScreen );
    // console.log('handleFullScreenChange, fullscreen:', isFullScreen);
  };


  onMount(async () => {
  if (typeof window !== 'undefined') {
    addCSS();
    const EasyMDEModule = await import('easymde');
    EasyMDE = EasyMDEModule.default;

    easyMDEInstance = new EasyMDE({
      element: textArea,
      spellChecker: false,
      initialValue: post?.body,
      toolbar: [
        'bold', 'italic', 'heading', '|', 'code', 'quote', 'unordered-list', 'ordered-list', '|',
        'link', 'image', 'table', '|', 'preview', 'side-by-side', 'fullscreen',
        {
          name: "upload-image",
          action: (editor) => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = e => {
              const file = e.target.files[0];
              if (file) uploadImage(file, editor);
            };
            fileInput.click();
          },
          className: "fa fa-picture-o",
          title: "Upload Image",
        },
        '||', '||',
        {
          name: 'save',
          action: saveArticle,
          className: 'fa fa-save ml-auto',
          title: 'Save Article',
        },
      ],
      onToggleFullScreen: handleFullScreenChange,
    });

    // Listen for the fullscreen and side-by-side events from EasyMDE
    // easyMDEInstance.codemirror.on('editorChange', handleEditorChange);
    // easyMDEInstance.codemirror.on('fullscreen', () => handleEditorChange(easyMDEInstance));
    easyMDEInstance.codemirror.on('change', () => hasUnsavedChanges = true);

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveArticle(); }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Apply the "prose" class to the preview pane
    const observer = new MutationObserver(() => {
      const previewPane = document.querySelector('.editor-preview-side');
      if (previewPane) {
        previewPane.classList.add('!max-w-none');  previewPane.classList.add('prose-lg');
        observer.disconnect(); // Stop observing once the class is added
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Apply custom styles for <aside> and other elements
    const style = document.createElement('style');
    style.textContent = `
      .editor-preview-side aside {
        padding: 1rem;
        margin: 1rem 0;
        background-color: #f9f9f9;
        border-left: 4px solid #ccc;
      }
    `;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }
});

  const uploadImage = async (file, editor) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const dataURL = e.target.result;
      const s3key = generateS3Key(file.name);
      const s3URL = await upload_s3(dataURL, s3key);
      const markdownImage = `![](${s3URL})`;
      editor.codemirror.replaceSelection(markdownImage);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    }
  };
  reader.readAsDataURL(file);
};

const generateS3Key = (filename) => {
  const datePart = (new Date()).toISOString().split('T')[0]; // YYYY-MM-DD
  const slug = post.id ? post.id.split('/')[0] : 'default-slug';
  return `uploads/${datePart}-${slug}-${filename}`;
};

const upload_s3 = async (dataURL, s3key) => {
  const base64Data = dataURL.split(',')[1];
  const mimeType = dataURL.substring(5, dataURL.indexOf(';base64'));
  const res = await fetch('/api/upload_s3', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionid}`
    },
    body: JSON.stringify({
      filedata: base64Data,
      mimeType,
      s3key,
      sessionid
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to upload to S3');
  return data.s3url;
};


  const saveArticle = async () => {
    const saveButton = document.querySelector('.fa-save');
    if (saveButton) {
      saveButton.style.color = 'gray';
      saveButton.style.fontSize = '14px';
    }
    content = easyMDEInstance.value();
    try {
      // post.body = content;
      const response = await fetch(`/api/post_db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionid}` },
        body: JSON.stringify({id:postid, body:content }),
      });
      if (!response.ok) throw new Error('Failed to save article');
      //await response.json();
      // console.log("Article saved successfully: ");
      hasUnsavedChanges = false;
    } catch (error) {
      console.error("Error saving article:", error);
    } finally {
      updateSaveButton(hasUnsavedChanges);
    }
  };

  // API Functions
  const loadPost = async () => {
    if (!postid) return;
    const url = `/api/post_db?id=${encodeURIComponent(btoa(postid))}`; // regular encoding does not work with Astro
    // console.log('Loading post from:', url);
    try {
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${sessionid}` } });
      if (response.ok) {
        post.body = (await response.json()).body
        easyMDEInstance.value(post.body);
        hasUnsavedChanges = false;
      } else {
        throw new Error('Failed to load post');
      }
    } catch (error) {
      console.error('Error loading post:', error);
    }
  };


  // const handleChange = (field, value) => {
  //   post[field] = value;
  //   dirty = true;
  //   if (timeoutId) clearTimeout(timeoutId);
  //   timeoutId = setTimeout(() => { if (dirty) savePost(); dirty = false; }, 10000);
  // };

  onMount(() => loadPost());
  onDestroy(() => { if (timeoutId) clearTimeout(timeoutId); });
</script>


  <div class={`w-full relative p-2 ${visible ? 'block' : 'hidden'}`}>
    <textarea class="relative" bind:this={textArea}></textarea>
  </div>


  <style>
    @import 'https://unpkg.com/easymde/dist/easymde.min.css';
    :global(.EasyMDEContainer .editor-toolbar) { display: flex; justify-content: space-between; }
    :global(.EasyMDEContainer .editor-toolbar .fa-save) { margin-left: auto; color: gray; }
    :global(.EasyMDEContainer .editor-toolbar:not(.fullscreen)) {
      position: sticky !important; top: 57px !important; background-color: white; z-index: 9999 !important; border-bottom: 1px solid silver;
    }
    :global(.EasyMDEContainer .editor-toolbar.fullscreen) {
      position: fixed !important; top: 5px !important; width: 100%; z-index: 9999 !important;
    }
    :global(.EasyMDEContainer .CodeMirror-fullscreen) { top: 55px !important; left: 0px !important; z-index: 9999 !important; }
    :global(.editor-toolbar) { z-index: 9999 !important; position: relative; }
    :global(.CodeMirror) { font-size: 16px !important; line-height: 1.5 !important; }
    :global(.editor-toolbar) { font-size: 14px; }
    :global(.EasyMDEContainer .cm-formatting-header) { color: #AAA !important; }
  </style>












