<script>
// svelte client-side editing functionality
// this component is responsible for editing all aspects of a post, not just markdown

import Editor from './easymde/Editor.svelte'; // markdown editor
import MetaEditor from './MetaEditor.svelte'; // meta data editor
import TabSwitcher from './TabSwitcher.svelte';
import LanguageSwitcher from './LanguageSwitcher.svelte';

export let baseid;
export let language;
export let site;
export let authorList;
export let topicList;
export let categoryList;
export let languages;
export let sessionid;
export let translations;

// to support language switching
$: postid = baseid + '/' + language + '.md';

let fullScreenMode = false; // Add this line
const handleFullScreenModeChange = (event) => {
  fullScreenMode = event.detail;
  console.log('fullScreenMode:', fullScreenMode);
};

console.log({translations})
// translations is now a list of language objects, not aritcles
const idLang = (id) => id.split('/')[1].split('.')[0];
const articleExists = (lang) => translations.filter(t => (idLang(t) === lang)).length > 0;
$: languages = languages.map(lang => ({...lang, enabled: articleExists(lang.id)}));
// sort language list by active (language===id), then enabled, then id
languages.sort((a, b) => a.id === language ? -1 : b.id === language ? 1 : a.enabled === b.enabled ? a.id.localeCompare(b.id) : b.enabled - a.enabled);


const handleTabSwitch = async (event) =>  activeTab = event.detail.tabId;
const tabs = [
  { id: 'content', title: 'Post Body' },
  { id: 'metadata', title: 'Post Data' },
];
let activeTab = 'content'; // Default to showing the content editor

let meta_props = { postid, sessionid, site, authorList, topicList, categoryList };
</script>

<div class="editor p-0 w-full h-auto my-4 ml-6 -mt-2">
  <!-- this content shows up in between the split panes in side-by-side editing mode -->
  <h3 class="text-xl mx-2 font-semibold ml-2 inline"> {postid} </h3>
  <div class="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-1">
    <div class="col-span-4">
      <TabSwitcher {tabs} {activeTab} on:tabSwitch={handleTabSwitch} />
    </div>
    <div class="col-span-4 min-w-[580px]">
      <Editor bind:postid={postid} {sessionid}
              visible={activeTab === 'content'}
              on:fullScreenModeChanged={handleFullScreenModeChange}/>
      <MetaEditor bind:postid={postid} {...meta_props}
                  visible={activeTab === 'metadata'} />
    </div>
    <div class="pt-3">
      <LanguageSwitcher {languages} {language} on:language={({detail}) => language=detail.id } />
    </div>
  </div>
</div>


