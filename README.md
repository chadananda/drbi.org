# DRBI Refresh

> Implement a DRBI version  

- [x] copy base site, remove existing content collections
- [x] rebrand, remove most pages
- [x] change "articles" to "posts" with "post_type" and build test
- [x] build out page stubs for key content, using MD
- [x] add super header component to home page with video background
- [x] add links to category pages, events calendar and wade's video to home
- [ ] create git repo, add deploy to vercel
- [ ] generate category files and develop description and topics based on DRBI core ideas
    - [ ] add category description to category generator
- [ ] redo readme, add Telahoun and begin migrate as much content as possible
- [ ] add post types for:
    - [ ] events
    - [ ] newsletter ??
    - [ ] in memorium
    - [ ]


 

## Coding style guide (for Copilot/Aider)

* CSS should use Tailwind classes for styling and avoid custom CSS where possible
* Every JS function should include a detailed JSDoc header explaining in terse but clear terms what it does. This is meant to be read by machine
* JavaScript should follow Airbnb style guide where possible
* Functions and methods should have descriptive names that clearly convey what they do
* Follow a "convention over configuration" style where practical to avoid boilerplate code
* Follow Astro coding conventions: https://docs.astro.build/en/getting-started/
* Use semantic HTML for SEO clarity
* Leverage Tailwind CSS utility classes for responsive design
* Follow best practices for accessibility
* Use Astro components and utilities where possible for shared UI
* Leverage Astro data hooks for fetching async data
* Code islands should be deferred using Astro's `<script setup>` SFCs
* Data fetching should leverage Astro's `useLoaderData` and `useDeferredData` hooks
* Shared UI components should be extracted to the `src/components` directory and imported
* All pages are static except for pages under /auth which are SSR and accessible by login only


# Astro Vercel Site with PostgreSQL Authentication System

## Serverless API Endpoints (`/api/`)
- **`register.js`**:
  - `handleRegistration()`: Handles user registration, including saving user data in PostgreSQL.
- **`login.js`**:
  - `handleLogin()`: Authenticates users and returns a JWT.
- **`reset-password.js`**:
  - `handlePasswordReset()`: Manages password reset requests and email sending.

## Utility Functions (`/src/utils/`)
- **`db.js`**:
  - `connectDB()`: Establishes a connection to the PostgreSQL database.
- **`jwtUtil.js`**:
  - `generateToken()`: Generates a JWT token.
  - `verifyToken()`: Verifies a JWT token.

## Frontend Pages (`/src/pages/`)
- **`auth/login.astro`**:
  - Contains the login form, submitting credentials to the `/api/login.js`.
- **`auth/register.astro`** (optional):
  - Registration form for new users.
- **`auth/reset-password.astro`** (optional):
  - Page for initiating a password reset.

## Initial Setup Check (`/api/setup.js`)
- **`checkDatabaseSetup.js`**:
  - Checks for the necessary tables; creates them if absent.



# Task: Implement Login System for Astro Vercel Site with PostgreSQL

## Objective
Develop a comprehensive login system for an Astro Vercel site with PostgreSQL, featuring user registration, authentication, password reset functionality, and an initial database setup check.

## Steps

1. **Serverless API Endpoints (`/api/`):**
   - `register.js`: Implement user registration, storing user details in the database.
   - `login.js`: Handle user login, generate JWT for authenticated sessions.
   - `reset-password.js`: Manage password reset functionality.
   - `setup.js`: check for database setup, also for user table

2. **Database Connection and Models (`/src/utils/`):**
   - `db.js`: Establish a PostgreSQL database connection.
   - `userModel.js`: Define user-related database operations (create, query).

3. **JWT Utility (`/src/utils/jwtUtil.js`):**
   - Implement functions for generating and verifying JWT tokens.

4. **Frontend Authentication Pages (`/src/pages/auth/`):**
   - `login.astro`: Frontend page for user login.
   - `register.astro` (Optional): Frontend page for user registration.
   - `reset-password.astro` (Optional): Frontend page for password reset.

5. **Initial Database Setup Check (`/api/setup.js`):**
   - Check for the existence of the PostgreSQL database connection
   - If not present, provide instructions for setting up Vercel PostgreSQL
   - If database connection but 'users' table is missing, create it and prompt the administrator to set their initial password.



Content Plan:

To develop FAQs and Author Pages, we need to create some content collections:

1. tag FAQs
  * tags are subject
  * List of questions, answers and related resources
  * FAQ on each Tag page

1. team Bios
  * objects for each author
  * Checks for author and gives author description and picture

1. Add some Ocean content
  * The Ocean Adventure
  * About Ocean 2.0 Interfaith Reader
  * Ocean: Reading and Search
  * Ocean: Study notes, translation & Compilations
  * Ocean: Exploring the Library
  * Ocean: Sharing quotes
  * Ocean: Help and Contribution

### Potential Article Data types

* Article (public, description, content)
* Team (public: description, style, bio, audio)
  * We'll need internal Complex Persona API
* Topic (public: description, keyword, FAQ)
* Category (internal: topics, keywords, questions)
  * We'll need a Keyword API
* ContentPlan (Article Topic/Keyword plans by Category)
* Serp (internal: top 100 results by keyword with top-10 summaries)
  * We'll need SERP API

### Article System Setup Process
_The organization structure of content needs to be like an accordion which can expand and contract to fit the content base.
 * _Category:_ Websites often have near-unrelated content by context or type such as articles and newsletters.
 * _Topic:_ allows many related articles to be interlinked with tags
 * _Subtopic:_ have a semantic meaning and a keyword cluster.
 * _SERPS:_ each keyword has traffic numbers and search results.
 * _Article:_ each article addresses one subtopic answering questions about that subtopic
_A typical website should have topical CATEGORIES, several writers covering each category, fifty MAIN TOPICS (tags) within each category, and a plan for at least 30 ARTICLES per topic. Each ARTICLE PLAN will have several related keywords organized into a keyword ladder._

* _Categories:_ Identify Categories & Semantic Topics (tags)
* _Keyword research:_ Generate a list of hypothetical keywords & questions for each topic
  * fetch list keyword phrases for each (min three words)
  * create SERP entries for each keyword phrase

    **subtopic questions prompt:**
    "Generate a list of concise questions reflecting the search intent of readers for a given SEO subtopic. The questions should be derived from the subtopic's title, its definition, and related keywords. Ensure each question is straightforward and avoids semantic duplication, directly addressing the most likely queries that could be answered effectively in an informational article. The goal is to cover the subtopic's key aspects comprehensively while remaining succinct."

* _Create team:_ of writers and Editors
  * Assign writing categories
  * Choose voice for each
  * Create social accounts for each
    * Post to social accounts
    * Purchase initial audience for each on fiverr
* _Content Planning:_ (By Category & Topic), create content plan
  * Each content plan has proposed thesis, keyword phrases, keyword ladder, author and editor
  * Each content plan has can be converted into a draft article outline
* Category (internal: topics, keywords, questions)
  * We'll need a Keyword API
* ContentPlan (Article Topic/Keyword plans by Category)
* Serp (internal: top 100 results by keyword with top-10 summaries)
  * We'll need SERP API


====================================

## Prompts:

### Generate a category entry: _categories/[category].md

Context:
  Category: SEO

Instructions:
  Create a list of specific and distinct topics within the given category. Each topic should be a focused aspect or a specialized area within the overarching category, ensuring that they are not too broad or generic to become categories in themselves. The topics should provide in-depth exploration opportunities within the category, offering unique and detailed insights or practices. They should be clearly differentiated from one another, avoiding overlap or repetition. The goal is to identify sub-areas that are integral to the category, providing a comprehensive yet specialized understanding relevant to professionals or enthusiasts in the field.

  You may use a hypothetical value for traffic.
  Output in YAML format in a code window in a format like this:

---
category: SEO
category_slug: seo
traffic: 8000
topics:
  technical-seo: "Technical SEO"
  on-page-seo: "On-Page SEO"
  off-page-seo: "Off-Page SEO"
  content-seo: "Content SEO"
  keyword-research: "Keyword Research"
  mobile-seo: "Mobile SEO"
  ...
---


### Generate category topic file with brief list of subtopics:  _topics/[topic].md

Context:
  Category: "Baha'i Faith"
  Topic: "Ocean Library"

Instructions:
  Generate a subject file for the given topic the context of the given category.
  Output a YAML object in a code window with the following fields:

* 'topic': the topic
* 'topic_slug': Provide a slugified version of the topic
* 'category': the category
* 'traffic': Total of the traffic for each of the keywords associated with this topic. (Use a hypothetical number here.)
* 'image': default value should be "image.png"
* 'description': Offer a brief semantic summary of the topic, highlighting its significance and scope within the main topic. This field should be in quotes
* 'subtopics': an list of ALL the specific and distinct subtopics within the given topic. Each subtopic should be a focused aspect or a specialized area within the topical category, ensuring that subtopics are not too broad or generic to become topics in themselves. The topics should provide in-depth exploration opportunities within the topical space. They should be clearly differentiated from one another, avoiding overlap or repetition. The goal is to identify sub-areas that are integral to the topic, providing a comprehensive yet specialized understanding relevant to professionals or enthusiasts in the field. Subtopics should the organized as an object of [subtopic slug]:[subtopic] fields.



### Generate detailed list of subtopic details:  _subtopics/[topic].md

Context:
  Category: "Baha'i Faith"
  Topic: "Bahá'í History"
  subtopics:
    the-bab-and-babi-movement: "The Bab and Babi Movement"
    life-of-bahaullah: "Life of Baha'u'llah"

Instructions:
  Develop detailed subtopic details, and generate a set of concise, intent-focused questions for each subtopic. This should be structured in a YAML format with fields for 'name', 'description', 'traffic', 'keywords', and 'questions' for each subtopic.

For each subtopic:

* subtopic: [this subtopic]
* subtopic_slug: [a slugified version of this subtopic]
* traffic: [total of all keyword traffic for the subtopic's keywords]
* keywords: List of semantically identical keywords likely to match the search intent. Keywords should be an object with keyword slug as the key and estimated traffic as the value. (Hypothetical values are acceptable, sorted from highest to lowest

Additionally, for each subtopic, create a list of questions by following these guidelines:

  Questions should directly reflect the search intent of readers, derived from the subtopic's title, definition, and keywords.
  Ensure clarity and conciseness in each question, avoiding semantic duplication.
  Questions should address likely queries that readers would seek to answer in an informational article.
  Aim to cover the subtopic's key aspects comprehensively yet succinctly.
  This comprehensive subtopic list with targeted questions will provide a deep and structured exploration of the topic within the broader category of SEO. It will serve as a guiding framework for content creation, research, and user engagement."
  Questions should each be in quotations.

Output as Yaml in a code Window




## FAQ Prompt
### Generate SEO FAQ Pages in YAML Format with Specific Resources:

Context:
  Category: "Baha'i Faith"
  Topic: "Ocean Library"
  Resources links:
  - https://oceanlibrary.com/about
  - constitution-of-the-universal-house-of-justice

Generate a comprehensive and engaging FAQ page for this category, focusing on this topic, and structure them in a YAML format. Utilize only the provided list of summary resources to enrich the answers. Each FAQ page should be well-organized, informative, and engaging, encouraging readers to explore the topic further.

Your task is to create a YAML object for an FAQ page with the following structure:

topic: [given topic]
topic_slug: [slugified version of topic]
category: [given category]
title: Develop a fun, punny, and click-bait title that reflects the essence of the topic in a humorous yet informative way.
description: Craft a concise (under 200 characters) but compelling description that highlights the key benefits and solutions provided by understanding the topic.
faqs: List relevant questions and provide detailed answers. Follow these guidelines for each FAQ entry:
question: Frame a question that is likely to among the most asked about the topic.
answer: Provide a thorough, conversational, yet competent answer. Aim to satisfy the reader's query in as few words as possible, incorporating practical tips and actionable insights.
resources: Include list of links from the provided list of summary resources that are relevant to the answer.

Remember to:
* Ensure the content is reader-friendly, engaging, and full of practical insights.
* Each FAQ should be topic-specific and not overlap with other SEO categories.
* Use the provided resources effectively to add depth to each answer.
* Output using a YAML code window




## image prompt

Subject: Baha'i Faith

Instructions: Please provide a wide image on this subject using the style defined below:

Style: Low fidelity watercolor image which looks hand-made on rough-press white paper. Emphasis on blue palletes a tiny bit of browne -- a very limited color range and white borders. Any background should be blurred and any forground low-fidelity hand-made watercolor paints. Some slight dripping is acceptable.


