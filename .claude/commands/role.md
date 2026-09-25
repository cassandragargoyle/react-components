# Switch Role

User requested to switch to role: **$ARGUMENTS**

## Instructions

1. **Normalize role name** - lowercase, dashes become underscores only where the file uses them

2. **Verify role exists** - check if file `.claude/roles/{role_name}.md` exists

3. **If role exists:**
   - Update `CLAUDE.local.md` in project root with include reference to role file
   - Write content: `@.claude/roles/{role_name}.md`
   - Confirm the role switch and briefly summarize key points of the new role

4. **If role does not exist:**
   - List available roles from `.claude/roles/` directory
   - Ask user to select a valid role

## Available roles

| Command | File | Description |
| ------- | ---- | ----------- |
| `/role architect` | architect.md | Software Architect |
| `/role developer` | developer.md | Developer |
| `/role techlead` | techlead.md | Tech Lead |
| `/role tester` | tester.md | Tester |
| `/role user` | user.md | End User |
