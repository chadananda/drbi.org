<script>
  import { onMount, onDestroy } from 'svelte';
  import slugger from 'slugify';

  export let postid, sessionid, site, visible, topicList, categoryList, authorList;

  const POST_TYPES = site.post_types || ["Article", "WebPage", "Event", "Organization", "Person", "LocalBusiness", "Product", "Recipe", "Review", "BreadcrumbList", "Course", "JobPosting", "Movie", "MusicAlbum", "QAPage", "SearchResultsPage", "SoftwareApplication", "VideoObject", "BookReview", "VideoReview", "Newsletter"];
  let post = {}, dirty = false, timeoutId = null, imagePreviewUrl = '', inputKeyword = '', inputTopic = '', keywordList = []
  let suggestedKeywords = [], suggestedTopics = [];
  let dateInput;

  // console.log('metaedit', {topicList, categoryList, authorList})

  // Helper Functions
  const slugify = (text) => slugger(`${text}`, { lower: true, strict: true });
  const wordCount = (text) => !!text ? `Words: ${text?.trim().split(/\s+/).filter(Boolean).length} | Characters: ${text?.length}` : '';
  const unSlugify = (slug) => slug.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const generateS3Key = (filename) => `uploads/${post.id.split('/')[0] || slugify(post.title)}/${slugify(filename)}`;
  const transformS3Url = (url='', width=300, height=200, format='webp', quality=90) => {
    if (!url.includes('.s3.')) return url;
    let params = [];
    const imagePath = new URL(url).pathname;
    params.push(`fm=${format}`,`q=${quality}`,`fit=crop`,`crop=faces`);
    if (width<400) params.push('usm=20&usmrad=20'); else params.push('sharp=20')
    return `${site.img_base_url}${imagePath}?${params.join('&')}`;
  };

  $: isSimplified = post.language != 'en';

  // API Functions
  const loadPost = async () => {
    if (!postid) return;
    const url = `/api/post_db?id=${encodeURIComponent(btoa(postid))}`;
    // console.log('Loading post from:', url);
    try {
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${sessionid}` } });
      if (response.ok) {
        const newPost = await response.json();
        if (newPost.body) delete newPost.body;
        post = { ...newPost, keywords: newPost.keywords || [], topics: newPost.topics || [] };
        imagePreviewUrl = post.image ? transformS3Url(post.image) : '';
        // console.log('Loaded post:', post.datePublished);
        if (!post.datePublished) post.datePublished = new Date().toISOString().split('T')[0];
          else post.datePublished = new Date(post.datePublished).toISOString().split('T')[0];
        // console.log('Loaded post:', post);
      } else {
        throw new Error('Failed to load post');
      }
    } catch (error) {
      console.error('Error loading post:', error);
    }
  };


  const savePost = async () => {
    try {
      let data = {...post}; if (post.body) delete fields.body;
      const response = await fetch('/api/post_db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionid}` },
        body: JSON.stringify({ id: post.id, data })
      });
      if (!response.ok) throw new Error('Failed to save post');
    } catch (error) {
      console.error('Error saving post:', error);
    }
  };

  const handleSaveShortcut = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's')
      {event.preventDefault(); if (dirty) savePost(); dirty = false;}
  };

  const uploadS3_API = async (dataURL, s3key) => {
    const base64Data = dataURL.split(',')[1];
    const mimeType = dataURL.substring(5, dataURL.indexOf(';base64'));
    const res = await fetch('/api/upload_s3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionid}` },
      body: JSON.stringify({ filedata: base64Data, mimeType, s3key, sessionid })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload to S3');
    return data.s3url;
  };

  const handleFileUpload = async (event, key) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const s3URL = await uploadS3_API(e.target.result, generateS3Key(file.name));
        if (s3URL) handleChange(key, s3URL);
      } catch (error) {
        console.error('Failed to upload media:', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (field, value) => {
    post[field] = value;
    if (field==='image') imagePreviewUrl = transformS3Url(value);
    dirty = true;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => { if (dirty) savePost(); dirty = false; }, 10000);
  };


  const addKeyword = (keyword) => {
    post.keywords = post.keywords || [];
    keyword = slugify(keyword);
    // console.log('addKeyword', keyword);
    if (keyword && !post.keywords.includes(keyword)) {
      post.keywords.push(keyword); inputKeyword = '';
      suggestedKeywords = []; dirty = true;
    }
  };
  const removeKeyword = (index) => { post.keywords.splice(index, 1); dirty = true; };

  const addTopic = (topic) => {
    post.topics = post.topics || [];
    topic = slugify(topic);
// console.log('addTopic', topic);
    if (topic && !post.topics.includes(topic)) {
      post.topics.push(topic); inputTopic = '';
      suggestedTopics = []; dirty = true;
    }
  };
  const removeTopic = (index) => { post.topics.splice(index, 1); dirty = true; };

  // Reactive Declarations
  $: suggestedKeywords = inputKeyword.trim() ? keywordList.filter(tag => tag.includes(inputKeyword) && !post.keywords.includes(tag)) : [];
  $: suggestedTopics = inputTopic.trim() ? topicList.filter(tag => tag.includes(inputTopic) && !post.topics.includes(tag)) : [];


  // $: console.log(post.topics)

  $: isFormValid = post.title && post.description && post.url;
  $: if (visible) loadPost();
  $: formattedDate = post.datePublished ? new Date(post.datePublished).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';



  onMount(() => {
    loadPost();
    window.addEventListener('keydown', handleSaveShortcut);
  });
  onDestroy(() => {
     if (timeoutId) clearTimeout(timeoutId);
     window.removeEventListener('keydown', handleSaveShortcut);
  });

</script>


<div class={`${visible ? 'block' : 'hidden'} mb-10 p-3 ${dirty ? 'bg-orange-100 border-red-500' : 'bg-slate-100 border-red-50'}`}>

  {#if !isFormValid}<p class="error-message bg-green-200 p-2 italic text-green-900 bold ">Some required fields are missing.</p>{/if}

  <div class={`form-container`}>
    <div class="input-group-container">

      <div class="input-group col-span-2">
        <label for="title">Title</label>
        <input type="text" class="text-lg" id="title" bind:value={post.title} on:input={(e) => handleChange('title', e.target.value)} />
        <p class="text-xs text-gray-500 mt-1 ml-2">{slugify(post.title)}</p>
      </div>


      {#if !isSimplified}
        <div class="input-group">
          <label for="image">Main Image</label>
          {#if imagePreviewUrl}
           <img src={imagePreviewUrl} alt="Main image" class="w-full h-auto max-h-[300px] mb-2 object-cover">
          {/if}
          <div style="display: flex; align-items: center;">
            <input type="text" id="image" value={post.image} on:input={(e) => post.image = e.target.value} placeholder="Paste or upload an image URL" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500" style="margin-right: 10px;">
            <label for="image-upload" class="cursor-pointer">
              <span style="font-size: 1.25rem;">📁</span>
              <input type="file" id="image-upload" on:change={(e) => handleFileUpload(e, 'image', true)} style="display: none;">
            </label>
          </div>

        </div>
      {/if}
      {#if !isSimplified}
        <div class="input-group mt-1">
          <label for="abstract">Article Abstract (target 500 chars)</label>
          <textarea id="abstract" bind:value={post.abstract} on:input={(e) => handleChange('abstract', e.target.value)}
            class="w-full h-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500
                  "></textarea>
          <p class="text-xs text-gray-500 mt-1 ml-2">{wordCount(post.abstract)}</p>
        </div>
      {/if}


      <div class="input-group">
        <label for="author">Author</label>
        <select id="author" bind:value={post.author} on:change={(e) => handleChange('author', e.target.value)}>
          <option value="">None</option>{#each authorList as author}<option value={author}>{unSlugify(author)}</option>{/each}
        </select>
      </div>
      <div class="input-group">
        <label for="editor">Editor</label>
        <select id="editor" bind:value={post.editor} on:change={(e) => handleChange('editor', e.target.value)}>
          <option value="">None</option>{#each authorList as author}<option value={author}>{unSlugify(author)}</option>{/each}
        </select>
      </div>


      <div class="input-group">
        <label for="description">Description (target 160 chars)</label>
        <textarea id="description" bind:value={post.description} on:input={(e) => handleChange('description', e.target.value)} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm h-24"></textarea>
        <p class="text-xs text-gray-500 mt-1 ml-2">{wordCount(post.description)}</p>
      </div>
      <div class="input-group">
        <label for="desc_125">Shorter Description (target 125 chars)</label>
        <textarea id="desc_125" bind:value={post.desc_125} on:input={(e) => handleChange('desc_125', e.target.value)} class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm h-24"></textarea>
        <p class="text-xs text-gray-500 mt-1 ml-2">{wordCount(post.desc_125)}</p>
      </div>


      <div class="input-group">
        <label for="audio">Audio File</label>
        <div style="display: flex; align-items: center;">
          <input type="text" id="audio" value={post.audio} on:input={(e) => post.audio = e.target.value} placeholder="Paste or upload an audio URL" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500" style="margin-right: 10px;">
          <label for="audio-upload" class="cursor-pointer">
            <span style="font-size: 1.25rem;">📁</span>
            <input type="file" id="audio-upload" on:change={(e) => handleFileUpload(e, 'audio')} accept="audio/*" style="display: none;" class="max-h-12">
          </label>
        </div>
      </div>

      <div class="input-group">
        <label for="audio_image">Audio Image</label>
        <div style="display: flex; align-items: center;">
          <input type="text" id="audio_image" value={post.audio_image} on:input={(e) => post.audio_image = e.target.value} placeholder="Paste or upload an audio image URL" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500" style="margin-right: 10px;">
          <label for="audio-image-upload" class="cursor-pointer">
            <span style="font-size: 1.25rem;">📁</span>
            <input type="file" id="audio-image-upload" on:change={(e) => handleFileUpload(e, 'audio_image')} style="display: none;">
          </label>
        </div>
      </div>


      <div class="input-group">
        <label for="category">Category</label>
        <select id="category" bind:value={post.category} on:change={(e) => handleChange('category', e.target.value)}>
          {#each categoryList as category}<option value={category}>{unSlugify(category)}</option>{/each}
        </select>
      </div>
      <div class="input-group">
        <label for="post_type">Post Type</label>
        <select id="post_type" bind:value={post.post_type} on:change={(e) => handleChange('post_type', e.target.value)}>
          {#each POST_TYPES as type}<option value={type}>{type}</option>{/each}
        </select>
      </div>



  <!-- Topics Section -->
    <div class="input-group relative mt-4">
      <label for="topics">Topics</label>
      <input type="text" id="topics" bind:value={inputTopic} on:input={(e) => inputTopic = e.target.value} on:keydown={(event) => event.key === 'Enter' && addTopic(inputTopic)} />
      {#if suggestedTopics.length > 0}
        <div class="absolute w-full mt-16 z-10">
          <ul class="bg-white border border-blue-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {#each suggestedTopics as suggestion}
              <li class="px-4 py-2 hover:bg-blue-100 cursor-pointer" on:click={() => addTopic(suggestion)}>{suggestion}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="flex flex-wrap gap-2 mt-2">
        {#each post.topics || [] as topic, index}
          <div class="flex items-center bg-blue-500 text-white text-xs rounded-full px-2 py-1">
            {topic}
            <div class="bg-transparent text-white ml-2 text-xs hover:cursor-pointer" on:click={() => removeTopic(index)}>×</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Keywords Section -->
    <div class="input-group relative mt-4">
      <label for="keywords">Keywords</label>
      <input type="text" id="keywords" bind:value={inputKeyword} on:input={(e) => inputKeyword = e.target.value} on:keydown={(event) => event.key === 'Enter' && addKeyword(inputKeyword)} />
      {#if suggestedKeywords.length > 0}
        <div class="absolute w-full mt-16 z-10">
          <ul class="bg-white border border-blue-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {#each suggestedKeywords as suggestion}
              <li class="px-4 py-2 hover:bg-blue-100 cursor-pointer" on:click={() => addKeyword(suggestion)}>{suggestion}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="flex flex-wrap gap-2 mt-2">
        {#each post.keywords || [] as keyword, index}
          <div class="flex items-center bg-blue-500 text-white text-xs rounded-full px-2 py-1">
            {keyword}
            <div class="bg-transparent text-white ml-2 text-xs hover:cursor-pointer" on:click={() => removeKeyword(index)}>×</div>
          </div>
        {/each}
      </div>
    </div>




      <div class="input-group">
        <label for="draft">Still a Draft</label>
        <input type="checkbox" id="draft" bind:checked={post.draft} on:change={(e) => handleChange('draft', e.target.checked)} />
      </div>



<div class="input-group">
  <label for="datePublished">Published Date</label>
  <div style="display: flex; align-items: center;">
    <!-- <span>{formattedDate}</span> -->
    <input type="date" bind:this={dateInput} bind:value={post.datePublished} on:change={(e) => handleChange('datePublished', e.target.value)} class="hidden-date-input" />
    <span on:click={() => dateInput.showPicker()} class="cursor-pointer ml-3" style="font-size: 1.25rem;">📅</span>
  </div>
</div>








    </div>
  </div>
</div>




<style>
.form-container { display: grid; gap: 10px; padding: 10px;  }
.input-group-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.input-group { display: flex; flex-direction: column; margin-bottom: 10px; }
.main-image { width: 100%; height: auto; max-height: 300px; margin-bottom: 10px; }
input, textarea, select {padding: 3px; border: 1px solid silver; border-radius: 4px; width: 100%; }
label {color: darkgray;}
.hidden-date-container { position: absolute; opacity: 0; }
.hidden-date-input { position: relative; }
</style>
