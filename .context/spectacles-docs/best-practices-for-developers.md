# Best Practices for Developers

Get the best out of your developer journey with Spectacles by following these guidelines and recommendations.

> **Canonical reference:** [Best Practices for Developers | Snap for Developers](https://developers.snap.com/spectacles/get-started/start-building/best-practices-for-developers) — use that page for the full, up-to-date expandable sections and screenshots.

---

## Start with sample projects

We highly encourage starting your Spectacles development journey with our sample projects. These projects showcase the capabilities of our APIs and the platform in general, providing you with practical examples and best practices.

### Accessing sample projects

Sample projects can be consumed in two ways:

#### Lens Studio Home page

Access samples directly from the Lens Studio interface to quickly get started with templates and examples.

#### GitHub repository

Visit our [**specs-devs** GitHub organization](https://github.com/specs-devs) for comprehensive access to all our development resources.

### Repository structure

Our [specs-devs](https://github.com/specs-devs) GitHub organization includes three main categories of resources:

| Category | Description |
| -------- | ----------- |
| [**Samples**](https://github.com/specs-devs/samples) | Example Lens Studio projects demonstrating APIs and platform capabilities. |
| [**Packages**](https://github.com/specs-devs/packages) | Reusable packages and utilities for Spectacles / Lens Studio development. |
| [**Context**](https://github.com/specs-devs/context) | Curated context material for AI-assisted workflows. |

---

## Project structure best practices

These are guidelines to help maintain clean, organized, and maintainable projects. The official guide expands each topic in depth.

- **Directory organization** — e.g. special folders, clean layout.
- **Language-specific organization** — e.g. dual TypeScript + JavaScript projects.
- **Code standards** — comments, variable hints, lifecycle methods, error handling, logging, code quality.
- **User experience enhancements** — e.g. in-lens education.
- **Documentation files** — `README.md`, `.gitignore`, `.gitattributes`, `LICENSE`.
- **Framework and component usage** — modern components, starting new projects, writing components, using packages.
- **Quick reference checklist** — security, Git hygiene, pre-publish checks.

---

## Sensitive file management

Protecting sensitive information in your projects is critical. **Never commit** tokens, API keys, passwords, or other credentials to Git repositories.

- **Best practices for credentials** — what to protect, Snap Cloud credentials, Remote Service Gateway, environment-specific files.
- **General security tips** — keep communication private; treat repo history as public.

---

## Collaboration on Git

Git collaboration for Lens Studio projects requires special consideration due to how scenes are managed.

- **Scene management strategy** — e.g. scene master approach and workflow patterns.
- **Prefab-driven development** — leverage prefabs to reduce scene merge pain.
- **Smart Git practices** — avoid blind `git add .`; prefer selective commits and clear directory organization.

---

## Recommended video resources

Essential video tutorials for Spectacles development:

1. **Introduction to Lens Studio** — Lens Studio basics and interface overview. *(See the [Snap AR YouTube channel](https://www.youtube.com/@SnapAR) or the canonical doc above for the latest link.)*
2. **Building Your First Lens** — [Watch tutorial →](https://www.youtube.com/watch?v=SV06iQYM0q0)
3. **Connected Lenses** — [Watch tutorial →](https://www.youtube.com/watch?v=P6hRHEDapCA)
4. **UIKit walkthrough** — [Watch tutorial →](https://www.youtube.com/watch?v=GkV6FRgibk8)
5. **Snap ML** — [Watch tutorial →](https://www.youtube.com/watch?v=hOQ68r_lKIQ)
6. **Snap Cloud** — [Watch tutorial →](https://www.youtube.com/watch?v=NI4kuZeFx0c)

Visit the [**Snap AR** YouTube channel](https://www.youtube.com/@SnapAR) for more tutorials and updates.
