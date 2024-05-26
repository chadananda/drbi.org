<script>
  import slugger from 'slugify';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  // import { transformS3Url } from "@utils/utils.js";


const transformS3Url = (url = '', width = null, height = null, format = 'webp', quality=0) => {
  url = url || '';
  if (!url.includes('.s3.')) return url;
  const imagePath = new URL(url).pathname;
  let params = [];
  if (width) params.push(`w=${width}`);
  if (height) params.push(`h=${height}`);
  // set default quality
  if (quality===0 && width<400) quality = 100; else if (quality===0) quality = 80;
  params.push(`fm=${format}`, `q=${quality}`, `fit=crop`, `crop=faces`);
  // sharpen small images
  if (width<400) params.push('usm=20&usmrad=20'); else params.push('sharp=20')
  const newURL = `${site.img_base_url}${imagePath}?${params.join('&')}`;
  // console.log('Formatted URL:', newURL);
  return newURL
}

const slugify = (text) => slugger(text, { lower: true, strict: true });

export let post, sessionid, authors, site, categories, topics, classes, visible;

const POST_TYPES = site.post_types || [
    "Article", "WebPage", "Event", "Organization", "Person", "LocalBusiness",
    "Product", "Recipe", "Review", "BreadcrumbList", "Course", "JobPosting",
    "Movie", "MusicAlbum", "QAPage", "SearchResultsPage", "SoftwareApplication",
    "VideoObject", "BookReview", "VideoReview", "Newsletter",
  ];

  let image = '';
  let title = '';
  let url = '';
  let description = '';
  let post_type = 'Article';
  let characterDescription = '';
  let abstract = '';
  let desc_125 = '';
  let audio = null;
  let audio_image = '';
  let narrator = 'auto';
  let author = '';
  let editor = '';
  let category = '';
  let postTopics = [];
  let keywords = [];
  let draft = false;
  let datePublished = '';

  $: formData = { image, title, url, description, post_type, characterDescription, abstract, desc_125, audio, audio_image, narrator, author, editor, category, postTopics, keywords, draft, datePublished, visible };

  $: {
    if (post) {
      image = post.data.image?.src || '';
      title = post.data.title || '';
      url = post.data.url || '';
      description = post.data.description || '';
      post_type = post.data.post_type || 'Article';
      characterDescription = post.data.characterDescription || '';
      abstract = post.data.abstract || '';
      desc_125 = post.data.desc_125 || '';
      audio = post.data.audio || null;
      audio_image = post.data.audio_image || '';
      narrator = post.data.narrator || 'auto';
      author = post.data.author || '';
      editor = post.data.editor || '';
      category = post.data.category || '';
      postTopics = post.data.topics || [];
      keywords = post.data.keywords || [];
      draft = post.data.draft || false;
      datePublished = post.data.datePublished || '';
    }
  }

  const isSimplified = (language) => (language != 'en');
  let simplified;
  $: simplified = isSimplified(language);

  let hiddenFields = ["image", "post_type", "author", "editor", "category", "topics", "keywords", "draft", "audio_image", "datePublished"];
  $: showField = (field) => !simplified || !hiddenFields.includes(field);


  // (url = '', width = null, height = null, format = 'webp', quality=0)
  const displayURL = (s3URL) => transformS3Url(s3URL, 300, 200, 'webp', 80);



  $: imagePreviewUrl = displayURL(formData['image']) || '';
  let inputKeyword = '', inputTopic = '';
  let suggestedKeywords = [], suggestedTopics = [];

  $: language = post ? post.data.language || 'en' : 'en';
  $: slug = (post.data.url && !post.data.draft) ? post.data.url : slugify(formData.title);
  $: id = post.id ? post.id : genPostID(formData.title)
  $: suggestedKeywords = inputKeyword.trim() ? topics.filter(tag => tag.includes(inputKeyword) && !keywords.includes(tag)) : [];
  $: suggestedTopics = inputTopic.trim() ? topics.filter(tag => tag.includes(inputTopic) && !postTopics.includes(tag)) : [];
  $: isFormValid = title.trim() && description.trim() && url.trim();

  const handleFileUpload = async (event, key) => {
    const file = event.target.files[0];
    if (!file) {
      console.error('No file selected');
      return;
    }
    if (!formData.title) return alert('An article title is required to upload any file.');
    if (file) {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const s3URL = await upload_s3(e.target.result, generateS3Key(file.name));
          // formData[key] = s3URL; // this is not updating
          formData = {...formData, image: s3URL}
          if (key === 'image') imagePreviewUrl = s3URL;
        } catch (error) {
          console.error('Failed to upload media:', error);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  function genPostID(title) {
    const stopWords = 'a the and or of in on at to for with by'.split(' ');
    if (language != 'en') return console.error('updatePost_DB: completely new post must be in English');
    let namePart = slugify(title).split('-').filter(w => !stopWords.includes(w)).slice(0, 4).join('-');
    let datePart = (new Date()).toLocaleDateString('en-CA');
    return `${datePart}-${namePart}/${language}.md`;
  }

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

  const saveForm = async () => {
    if (isFormValid) dispatch('save', { formData, sessionid });
    else alert('Please fill all required fields before submitting.');

    const { title, post_type, description, desc_125, abstract, language, audio, audio_image,
      draft, author, editor, category, postTopics, keywords } = formData;
    const updatedPost = {
      id, slug, collection: "posts",
      data: {
        title, post_type, description, desc_125, abstract, language, audio, audio_image, draft, author, editor, category, postTopics, keywords,
        url: slug,
        language: post.data.language || 'en',
        image: {
          src: formData.image,
          alt: formData.title
        },
        datePublished: new Date(post.data.datePublished),
        dateModified: new Date(),
        narrator: post.data.narrator || '',
        audio_duration: post.data.audio_duration | '',
      },
      body: post.body
    };

    if (await updatePostAPI(updatedPost, sessionid)) {
      alert('Post saved successfully');
    } else {
      alert('Failed to save post');
    }
  };

  const updatePostAPI = async (post, sessionid) => {
    try {
      const response = await fetch(`/api/article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post, sessionid }),
      });
      if (response.ok) {
        let data = await response.json();
        return true
      } else {
        const errorBody = await response.json();
        return false
      }
    } catch (error) {
      console.error("Error saving article:", error);
      return false
    }
  }

  const handleInputChange = (type, value) => type === 'keyword' ? inputKeyword = value : inputTopic = value;
  const modifyList = (list, item, add = true, index = -1) => add ? [...list, slugify(item)] : list.filter((_, i) => i !== index);
  const generateS3Key = (filename) => `uploads/${post.id.split('/')[0] || slug}/${slugify(filename)}`;
  const wordCount = text => `Words: ${text.trim().split(/\s+/).filter(Boolean).length} | Characters: ${text.length}`;
  const unSlugify = (slug) => slug.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const filterKeywords = (event) => inputKeyword = event.target.value;

  function addKeyword(keyword) {
    keyword = slugify(keyword);
    if (keyword && !keywords.includes(keyword)) {
      keywords = [...keywords, keyword];
      inputKeyword = '';
      suggestedKeywords = [];
    }
  }

  function removeKeyword(index) {
    keywords = keywords.filter((_, i) => i !== index);
  }

  function addTopic(topic) {
    topic = slugify(topic);
    if (topic && !postTopics.includes(topic)) {
      postTopics = [...postTopics, topic];
      inputTopic = '';
      suggestedTopics = [];
    }
  }

  function removeTopic(index) {
    postTopics = postTopics.filter((_, i) => i !== index);
  }

  </script>




<div class={`${visible ? 'block' : 'hidden'}`}>
  <p class="error-message">
    {#if !isFormValid}
      Some required fields are missing.
    {/if}
  </p>

  <div class={`form-container ${language === 'en' ? '' : 'simplified'}`}>
    {#if showField('image')}
      <div class="input-group w-full">
        <label for="Main Image">Main Image</label>
        <img src={imagePreviewUrl} alt="Main image" style="width: 100%; height: auto; max-height: 300px; margin-bottom: 10px;">
        {#if imagePreviewUrl === ''}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100" height="100" style="display: block; margin: auto;">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M12 2c-3.75 0-7.5 3.75-7.5 7.5S8.25 17 12 17s7.5-3.75 7.5-7.5S15.75 2 12 2zm0 12.5c-2.75 0-5-2.25-5-5s2.25-5 5-5 5 2.25 5 5-2.25 5-5 5zM4.25 3.5h2.5v2.5h-2.5V3.5zm15 12.5H4.75c-1.25 0-2.25-1-2.25-2.25V8c0-1.25 1-2.25 2.25-2.25h14.5c1.25 0 2.25 1 2.25 2.25v6c0 1.25-1 2.25-2.25 2.25zM5.5 12.5c0 .75.5 1.25 1.25 1.25s1.25-.5 1.25-1.25-.5-1.25-1.25-1.25S5.5 11.75 5.5 12.5zm12.5 0c0 .75.5 1.25 1.25 1.25s1.25-.5 1.25-1.25-.5-1.25-1.25-1.25-1.25.5-1.25 1.25z" />
          </svg>
        {/if}
        <div style="display: flex; align-items: center;">
          <input type="text" id="image-url" value={image} on:input={(e) => image = e.target.value} placeholder="Paste or upload an image URL" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500" style="margin-right: 10px;">
          <label for="image-upload" class="cursor-pointer">
            <span style="font-size: 1.25rem;">📁</span>
            <input type="file" id="image-upload" on:change={(e) => handleFileUpload(e, 'image', true)} style="display: none;">
          </label>
        </div>
      </div>
    {/if}

    <div class="input-group mt-4">
      <label for="abstract" class="block text-sm font-medium text-gray-700">Article Abstract (target 500 chars) </label>
      <textarea value={abstract} on:input={(e) => abstract = e.target.value} id="abstract" placeholder="Abstract" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500"></textarea>
      <p class="text-xs text-gray-500 mt-1 ml-2">{ wordCount(abstract) }</p>
    </div>

    {#if showField('title')}
      <div class="input-group">
        <label for="title">Title</label>
        <input value={title} on:input={(e) => title = e.target.value} id="title" placeholder="Title" class="max-h-10">
        <p class="text-xs text-gray-500 mt-1 ml-2">{slug}</p>
      </div>
    {/if}

    {#if showField('post_type')}
      <div class="input-group">
        <label for="post_type" class="block text-sm font-medium text-gray-700">Post Type</label>
        <select value={post_type} on:change={(e) => post_type = e.target.value} id="post_type" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md max-h-10">
          {#each POST_TYPES as type}
            <option>{type}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if showField('author')}
      <div class="input-group">
        <label for="author" class="block text-sm font-medium text-gray-700">Author</label>
        <select value={author} on:change={(e) => author = e.target.value} id="author" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md max-h-10">
          <option value="">None</option>
          {#each authors as author}
            <option value={author}>{unSlugify(author)}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if showField('editor')}
      <div class="input-group">
        <label for="editor" class="block text-sm font-medium text-gray-700">Editor</label>
        <select value={editor} on:change={(e) => editor = e.target.value} id="editor" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md max-h-10">
          <option value="">None</option>
          {#each authors as author}
            <option value={author}>{unSlugify(author)}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if showField('description')}
      <div class="input-group">
        <label for="description" class="block text-sm font-medium text-gray-700">Description (target 160 chars)</label>
        <textarea value={description} on:input={(e) => description = e.target.value} id="description" placeholder="Description" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm h-24"></textarea>
        <p class="text-xs text-gray-500 mt-1 ml-2">{ wordCount(description) }</p>
      </div>
    {/if}

    {#if showField('desc_125')}
      <div class="input-group">
        <label for="desc_125" class="block text-sm font-medium text-gray-700">Shorter Description (target 125 chars)</label>
        <textarea value={desc_125} on:input={(e) => desc_125 = e.target.value} id="desc_125" placeholder="Shorter Desc" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm h-24"></textarea>
        <p class="text-xs text-gray-500 mt-1 ml-2">{ wordCount(desc_125) }</p>
      </div>
    {/if}

    {#if showField('audio')}
      <div class="input-group mt-4">
        <label for="audio" class="block text-sm font-medium text-gray-700">Audio File</label>
        <div style="display: flex; align-items: center;">
          <input type="text" id="audio" value={audio} on:input={(e) => audio = e.target.value} placeholder="Paste or upload an audio URL" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500" style="margin-right: 10px;">
          <label for="audio-upload" class="cursor-pointer">
            <span style="font-size: 1.25rem;">📁</span>
            <input type="file" id="audio-upload" on:change={(e) => handleFileUpload(e, 'audio')} accept="audio/*" style="display: none;" class="max-h-12">
          </label>
        </div>
      </div>
    {/if}

    {#if showField('audio_image')}
      <div class="input-group mt-4">
        <label for="audio_image" class="block text-sm font-medium text-gray-700">Audio Image</label>
        <div style="display: flex; align-items: center;">
          <input type="text" id="audio_image" value={audio_image} on:input={(e) => audio_image = e.target.value} placeholder="Paste or upload an audio image URL" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500" style="margin-right: 10px;">
          <label for="audio-image-upload" class="cursor-pointer">
            <span style="font-size: 1.25rem;">📁</span>
            <input type="file" id="audio-image-upload" on:change={(e) => handleFileUpload(e, 'audio_image')} style="display: none;">
          </label>
        </div>
      </div>
    {/if}

    {#if showField('category')}
      <div class="input-group">
        <label for="category" class="block text-sm font-medium text-gray-700">Category</label>
        <select value={category} on:change={(e) => category = e.target.value} id="category" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md max-h-10">
          {#each categories as category}
            <option value={category}>{unSlugify(category)}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if showField('draft')}
      <div class="input-group">
        <label for="draft">Still a Draft</label>
        <input type="checkbox" id="draft" checked={draft} on:change={(e) => draft = e.target.checked} class="max-h-6">
      </div>
    {/if}

    {#if showField('topics')}
      <div class="input-group relative mt-4">
        <label for="topics" class="block text-sm font-medium text-gray-700">Topics</label>
        <input type="text" id="topics" class="w-full px-3 py-2 border border-blue-500 rounded-full focus:outline-none focus:border-blue-700 max-h-10" placeholder="Add topic..." value={inputTopic} on:input={(e) => inputTopic = e.target.value} on:keydown={(event) => event.key === 'Enter' && addTopic(inputTopic)} autocomplete="off">
        {#if suggestedTopics.length > 0}
          <div class="absolute w-full mt-16 z-10">
            <ul class="bg-white border border-blue-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {#each suggestedTopics as suggestion}
                <li class="px-4 py-2 hover:bg-blue-100 cursor-pointer" on:click={() => addTopic(suggestion)}>
                  {suggestion}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        <div class="flex flex-wrap gap-2 mt-2">
          {#each postTopics as topic, index}
            <div class="flex items-center bg-blue-500 text-white text-xs rounded-full px-2 py-1">
              {topic}
              <div class="bg-transparent text-white ml-2 text-xs hover:cursor-pointer" on:click={() => removeTopic(index)}>×</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if showField('keywords')}
      <div class="input-group relative mt-4">
        <label for="keywords" class="block text-sm font-medium text-gray-700">Keywords</label>
        <input type="text" id="keywords" class="w-full px-3 py-2 border border-blue-500 rounded-full focus:outline-none focus:border-blue-700 max-h-10" placeholder="Add keyword..." value={inputKeyword} on:input={(e) => handleInputChange('keyword', e.target.value)} on:keydown={(event) => event.key === 'Enter' && addKeyword(inputKeyword)} autocomplete="off">
        {#if suggestedKeywords.length > 0}
          <div class="absolute w-full mt-16 z-10">
            <ul class="bg-white border border-blue-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {#each suggestedKeywords as suggestion}
                <li class="px-4 py-2 hover:bg-blue-100 cursor-pointer" on:click={() => addKeyword(suggestion)}>
                  {suggestion}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        <div class="flex flex-wrap gap-2 mt-2">
          {#each keywords as keyword, index}
            <div class="flex items-center bg-blue-500 text-white text-xs rounded-full px-2 py-1">
              {keyword}
              <div class="bg-transparent text-white ml-2 text-xs hover:cursor-pointer" on:click={() => removeKeyword(index)}>×</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="w-full mb-20 mt-10 text-center">
    <button on:click={saveForm} disabled={!isFormValid} class="max-w-2xl mx-auto">Save Post</button>
  </div>
</div>





<style>
  .delete-btn {
   background: none;
   border: none;
   color: inherit;
   /* Inherit the text color from the parent */
   font-size: 0.75rem;
   /* Smaller font size */
   cursor: pointer;
   margin-left: 8px;
  }

  .form-container {
   display: grid;
   grid-template-columns: 1fr 1fr;
   gap: 20px;
   padding: 20px;
   background-color: #f9f9f9;
  }

  .form-container.simplified {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px;
    background-color: #f9f9f9;

  }

  .input-group {
   display: flex;
   flex-direction: column;
   margin-bottom: 10px;
  }

  .input-row {
   display: flex;
   justify-content: space-between;
   align-items: center;
  }

  label {
   margin-right: 10px;
  }

  input,
  textarea,
  select {
   flex-grow: 1;
   padding: 8px;
   border: 1px solid #ccc;
   border-radius: 4px;
  }

  button {
   width: 100%;
   padding: 10px;
   background-color: #007BFF;
   color: white;
   border: none;
   border-radius: 5px;
   cursor: pointer;
  }

  button:hover {
   background-color: #0056b3;
  }
  </style>
