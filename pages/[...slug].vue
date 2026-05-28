<script setup lang="ts">
const route = useRoute()
const path = '/' + (Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug || '')

const { data: page } = await useAsyncData(`content-${path}`, () => {
  return queryCollection('content').path(path).first()
})

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
  })
}

useHead({
  title: page.value.title || 'VibeFront',
})
</script>

<template>
  <article v-if="page" class="prose prose-invert prose-zinc max-w-none
    prose-headings:tracking-tight
    prose-h1:text-3xl prose-h1:font-bold prose-h1:text-zinc-100 prose-h1:mb-8
    prose-h2:text-xl prose-h2:font-semibold prose-h2:text-zinc-200 prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:border-zinc-800 prose-h2:pb-3
    prose-h3:text-lg prose-h3:font-medium prose-h3:text-zinc-300
    prose-p:text-zinc-400 prose-p:leading-relaxed
    prose-strong:text-zinc-200 prose-strong:font-semibold
    prose-code:text-emerald-400 prose-code:bg-zinc-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
    prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-lg
    prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:text-emerald-300
    prose-blockquote:border-l-emerald-500 prose-blockquote:text-zinc-400
    prose-li:text-zinc-400
    prose-hr:border-zinc-800
  ">
    <ContentRenderer :value="page" />
  </article>
</template>
