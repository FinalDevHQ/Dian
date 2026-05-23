import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/dian/',
  title: "Dian",
  description: "Dian 插件开发文档",
  lang: 'zh-CN',
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: '指南', link: '/guide/quick-start' },
      { text: 'API', link: '/api/decorators' },
      { text: '示例', link: '/examples/hello-world' },
      { text: '进阶', link: '/advanced/hot-reload' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '项目结构', link: '/guide/project-structure' },
            { text: '插件生命周期', link: '/guide/plugin-lifecycle' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API 参考',
          items: [
            { text: '装饰器', link: '/api/decorators' },
            { text: 'EventContext', link: '/api/event-context' },
            { text: 'PluginStore', link: '/api/plugin-store' },
            { text: 'SetupContext', link: '/api/setup-context' }
          ]
        }
      ],
      '/examples/': [
        {
          text: '示例',
          items: [
            { text: 'Hello World', link: '/examples/hello-world' },
            { text: '自定义插件', link: '/examples/custom-plugin' }
          ]
        }
      ],
      '/advanced/': [
        {
          text: '进阶',
          items: [
            { text: '热重载', link: '/advanced/hot-reload' },
            { text: '开发 CLI', link: '/advanced/dev-cli' },
            { text: 'Bot Scope', link: '/advanced/bot-scope' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/finaldevhq/dian' }
    ],

    footer: {
      message: '基于 MIT 许可发布',
      copyright: '© 2024 Dian'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/finaldevhq/dian/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页面'
    }
  }
})
