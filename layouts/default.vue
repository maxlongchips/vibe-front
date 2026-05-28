<script setup lang="ts">
import { Zap, BookOpen, FlaskConical, Code2 } from 'lucide-vue-next'

const navLinks = [
  { label: '学习路线', path: '/roadmap', icon: BookOpen },
  { label: 'Prompt 库', path: '/prompts', icon: FlaskConical },
  { label: '实战演练', path: '/playground', icon: Code2 },
]
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-300">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 z-50 h-14 backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800 glow-border">
      <div class="max-w-4xl mx-auto h-full flex items-center justify-between px-6">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2 group">
          <Zap class="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
          <span class="text-lg font-semibold text-zinc-100 tracking-tight">
            VibeFront
          </span>
          <span class="text-xs text-zinc-500 font-mono hidden sm:inline">⚡</span>
        </NuxtLink>

        <!-- Navigation -->
        <nav class="flex items-center gap-1">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded-md transition-all duration-200"
          >
            <component :is="link.icon" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ link.label }}</span>
          </NuxtLink>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="pt-14">
      <div class="max-w-4xl mx-auto px-6 py-12">
        <slot />
      </div>
    </main>
  </div>
</template>
