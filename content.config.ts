import { defineCollection, defineContentConfig } from '@nuxt/content'
import { z } from 'zod'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: '**/*',
      schema: z.object({
        tags: z.array(z.string()).optional(),
        category: z.string().optional(),
      }),
    }),
  },
})
