# Motion AI Kit Setup Notes (Project)

Source: https://motion.dev/docs/ai-kit

## What this gives our agents
- /motion (Motion expert guidance)
- /motion-audit (animation performance audit)
- /css-spring (generate spring-like CSS linear easing)
- /see-transition (visual transition reasoning)
- Motion docs search through Motion MCP

## Install command (requires Motion personal token)
1. Create token: https://plus.motion.dev/personal-token
2. Run:

```bash
curl -sL "https://api.motion.dev/registry/skills/motion-ai-kit?token=YOUR_TOKEN" -o /tmp/ai-kit.sh && bash
```

This installer supports: Claude Code, Gemini CLI, OpenCode, Cursor, Windsurf, Amp, VS Code.

## Project convention for all 3 CLIs + Hermes
- Read this file before animation work.
- Use `motion/react` primitives for React/Next.js animations.
- Prefer transform/opacity animation for performance.
- Keep transitions short for dashboard UX (~0.2–0.4s).
