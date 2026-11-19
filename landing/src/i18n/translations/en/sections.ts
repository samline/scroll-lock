import { project } from '../../../../../shared/lib/project.mjs'
const text = (value: string) => [{ kind: 'text' as const, value }]
const heading = (prefix: string, accent: string) => [
  { kind: 'text' as const, value: prefix + ' ' },
  { kind: 'emphasis' as const, value: accent },
]
const code = (
  filename: string,
  source: string,
  language: 'html' | 'javascript' | 'bash' | 'css'
) => ({
  filename,
  code: source,
  language,
})

const markup = `<button type="button" id="open">Read the terms</button>

<dialog id="terms" data-scroll-lock>
  <p>…</p>
  <form method="dialog"><button>Close</button></form>
</dialog>`

const script = `import { autoScrollLock } from '@samline/scroll-lock'

autoScrollLock()

document.querySelector('#open').addEventListener('click', () => {
  document.querySelector('#terms').showModal()
})`

const sections = {
  hero: {
    seoTitle: 'Lock page scroll for modals, drawers and menus',
    seoDescription:
      'Lock the page scroll behind modals, drawers and menus, with nested locks, no layout shift, the scroll position kept and a fix for iOS Safari.',
    kicker: 'Hold the page. Let it go cleanly.',
    title: project.name,
    // A non-breaking space keeps the last two words together, so no word wraps alone.
    titleAccent: 'The page stays put while your modal is open.',
    description:
      'Mark a dialog with data-scroll-lock, or call lockScroll(), and the page behind it stops scrolling without jumping sideways, even on iPhone.',
    descriptionContinuation: 'Install it, try the live preview, then read the full reference.',
    footnotes: ['About 3.8 KB gzip', 'Zero dependencies', `${project.license} licensed`],
    compatibilityLabel: 'ONE SMALL SCRIPT. RIGHT AT HOME IN YOUR STACK.',
    platforms: ['JavaScript', 'TypeScript', 'React', 'Vue', 'Svelte', 'Shopify', 'WordPress'],
  },
  features: {
    eyebrow: '01 / More than overflow: hidden',
    title: 'One line of CSS,',
    titleAccent: 'and everything it misses.',
    items: {
      dependencies: {
        icon: 'layers',
        title: 'Locks that nest',
        description: text(
          'A drawer opens a dialog that opens a menu: each holds its own lock, and the page unlocks after the last one, in any order.'
        ),
      },
      accessibility: {
        icon: 'ruler',
        title: 'No sideways jump',
        description: text(
          'The scrollbar width moves to the body padding and to --scroll-lock-gap, so content and fixed headers stay where they were.'
        ),
      },
      lifecycle: {
        icon: 'anchor',
        title: 'Back where it was',
        description: text(
          'The scroll position survives the lock, and comes back at once on release, even with scroll-behavior: smooth.'
        ),
      },
      entrypoints: {
        icon: 'hand',
        title: 'Works on iPhone',
        description: text(
          'Mobile Safari ignores overflow: hidden. On iOS the lock blocks page touches and keeps inputs above the keyboard instead.'
        ),
      },
      frameworks: {
        icon: 'eye',
        title: 'Follows your dialogs',
        description: text(
          'data-scroll-lock on a dialog, details, popover or any element locks while it is open and releases when it closes or leaves.'
        ),
      },
      markup: {
        icon: 'brush',
        title: 'Visible to CSS',
        description: text(
          'data-scroll-lock-state marks the locked page and each element that holds a lock, ready for backdrops and transitions.'
        ),
      },
    },
  },
  runtimes: {
    eyebrow: '02 / Fit it into your stack',
    heading: heading('An attribute first.', 'A function when you need it.'),
    description: 'Without JavaScript the page simply keeps scrolling; nothing breaks.',
    items: {
      main: {
        label: 'Package',
        entrypoint: project.npmName,
        description:
          'lockScroll, createScrollLock, scrollLock and autoScrollLock as ESM or CommonJS.',
      },
      vanilla: {
        label: 'One lock',
        entrypoint: 'lockScroll(options)',
        description: 'Returns the release, safe to call twice.',
      },
      browser: {
        label: 'Whole page',
        entrypoint: 'autoScrollLock(options)',
        description: 'Every [data-scroll-lock], including elements added later.',
      },
      global: {
        label: 'HTML / CDN',
        entrypoint: 'window.ScrollLock',
        description: 'A classic script that starts on its own.',
      },
      core: {
        label: 'Per component',
        entrypoint: 'createScrollLock(options)',
        description: 'lock, unlock and toggle without double releases.',
      },
      style: {
        label: 'Styling',
        entrypoint: 'No stylesheet',
        description: 'Style the locked page with data-scroll-lock-state.',
      },
    },
  },
  gettingStarted: {
    eyebrow: '03 / Install and lock',
    heading: heading('One attribute.', 'One call.'),
    integrationDescription: 'Lock the page behind a modal dialog while it is open.',
    integrationLabel: 'Read the installation guide',
    steps: { install: 'Install', markup: 'Mark the dialog', initialize: 'Start it' },
    installLabel: 'Installation method',
    installTabs: [],
    fullExampleLabel: 'Copy complete working files',
    markupDescription:
      'data-scroll-lock on a dialog, details, popover or any element that shows and hides.',
    examples: {
      markup: code('index.html', markup, 'html'),
      script: code('main.js', script, 'javascript'),
    },
    docs: {
      description: 'Continue with every option, the attributes and how iOS is handled.',
      label: 'Explore the options',
    },
  },
  recipes: {
    eyebrow: '04 / Beyond dialogs',
    title: 'One lock.',
    titleAccent: 'Every kind of overlay.',
    description: 'Three common jobs, without touching overflow yourself.',
    examplesLabel: 'Explore working examples',
    items: [
      {
        title: 'Lock from your code',
        context: 'lockScroll()',
        docsRoute: 'api' as const,
        docsLabel: 'Read the API',
        description: text('Hold the release, call it once.'),
        code: code(
          'main.js',
          `const unlock = lockScroll()\n\ndrawer.addEventListener('close', unlock, { once: true })`,
          'javascript'
        ),
      },
      {
        title: 'Keep a fixed header still',
        context: '--scroll-lock-gap',
        docsRoute: 'options' as const,
        docsLabel: 'Read the options',
        description: text('Pad it by the removed scrollbar.'),
        code: code(
          'style.css',
          `.header {\n  padding-right: var(--scroll-lock-gap, 0px);\n}`,
          'css'
        ),
      },
      {
        title: 'Toggle a menu',
        context: 'createScrollLock',
        docsRoute: 'api' as const,
        docsLabel: 'Read the API',
        description: text('One lock per component.'),
        code: code(
          'main.js',
          `const lock = createScrollLock()\n\nbutton.addEventListener('click', () => {\n  menu.hidden = !menu.hidden\n  lock.toggle(!menu.hidden)\n})`,
          'javascript'
        ),
      },
    ],
  },
  faq: {
    eyebrow: '05 / Before you build',
    heading: heading('A few details.', 'Clearly answered.'),
    items: {
      docs: {
        question: text('Why not just overflow: hidden on the body?'),
        answer: text(
          'It works on desktop until two overlays share it, the scrollbar disappears and the page shifts, or the page sets overflow on html. On iPhone it does not stop scrolling at all.'
        ),
      },
      copy: {
        question: text('Does it work without a bundler?'),
        answer: text(
          'Yes. Load dist/browser/scroll-lock.global.js; it watches [data-scroll-lock] on its own, and ScrollLock.lock() and ScrollLock.unlock() work from inline handlers. Pin the version in production.'
        ),
      },
      changes: {
        question: text('What does it do on iOS Safari?'),
        answer: text(
          'It blocks touch scrolling outside scrollable areas, stops scrollable areas from handing the scroll to the page at their edges, and keeps focused inputs above the keyboard, then restores the position on release.'
        ),
      },
      header: {
        question: text('Does it trap focus or hide the background from screen readers?'),
        answer: text(
          'No. It only stops scrolling. showModal() on a dialog already traps focus and makes the rest of the page inert; use it, or inert, for custom overlays.'
        ),
      },
      observer: {
        question: text('What if two components lock at once?'),
        answer: text(
          'Each lock counts. The page unlocks only after every lock is released, and releasing the same lock twice does nothing.'
        ),
      },
      smooth: {
        question: text('Will my page jump when the scrollbar disappears?'),
        answer: text(
          'No. Its width is added to the body padding, and to --scroll-lock-gap for fixed elements. With scrollbar-gutter: stable nothing needs to move.'
        ),
      },
      nojs: {
        question: text('What happens without JavaScript?'),
        answer: text(
          'The page keeps scrolling behind the overlay, as it would without the package. Nothing is hidden or broken.'
        ),
      },
      dynamic: {
        question: text('Do dialogs added later work?'),
        answer: text(
          'Yes. autoScrollLock watches the page, locks for elements added at any time, and releases the lock of elements that are removed while open.'
        ),
      },
    },
  },
  callToAction: {
    eyebrow: 'Scroll, held still',
    heading: heading('Every overlay,', 'a steady page.'),
    description: 'Try the examples or follow the first steps.',
    docs: {
      description: 'Guides, the complete API and release notes, in one place.',
      label: 'Read the documentation',
    },
  },
} as const

export default sections
