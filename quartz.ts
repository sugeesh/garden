import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { PageTypeDispatcher } from "./quartz/plugins/pageTypes"
import HomeLink from "./quartz/components/HomeLink"

const config = await loadQuartzConfig()
export const layout = await loadQuartzLayout()

// Put a "← sugeesh.dev" link at the top of the left sidebar on every page type
// that has one, then swap in a dispatcher built from this layout.
const homeLink = HomeLink()
const lefts = new Set([layout.defaults.left, ...Object.values(layout.byPageType).map((l) => l.left)])
for (const left of lefts) {
  if (left && left.length > 0) left.unshift(homeLink)
}
config.plugins.emitters = [
  ...config.plugins.emitters.filter((e) => e.name !== "PageTypeDispatcher"),
  PageTypeDispatcher(layout),
]

export default config
