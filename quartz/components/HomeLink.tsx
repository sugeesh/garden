import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

// A way back to the main site, shown above the garden's own title.
function HomeLink({ displayClass }: QuartzComponentProps) {
  return (
    <a class={classNames(displayClass, "home-link")} href="https://sugeesh.dev">
      ← sugeesh.dev
    </a>
  )
}

HomeLink.css = `
.home-link {
  display: inline-block;
  width: max-content;
  color: var(--faint, var(--gray));
  font-family: var(--mono, var(--codeFont));
  font-size: 0.8rem;
  letter-spacing: 0.02em;
  transition: color 0.2s ease;
}
.home-link:hover { color: var(--gold-1, var(--secondary)); }
/* the mobile sidebar is a single row; the footer link covers small screens */
@media (max-width: 800px) {
  .home-link { display: none; }
}
`

export default (() => HomeLink) satisfies QuartzComponentConstructor
