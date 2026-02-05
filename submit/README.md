# Skill 提交材料

本目录包含向各平台提交 harmonyos-build-deploy skill 的材料。

## 提交渠道

### 1. awesome-claude-skills (推荐先提交)

**仓库**: https://github.com/travisvn/awesome-claude-skills

**步骤**:
1. Fork 仓库
2. 编辑 README.md，在 "Individual Skills" 部分添加条目
3. 提交 PR

**PR 内容**: 见 `awesome-claude-skills-pr.md`

**添加的条目**:
```markdown
| **[harmonyos-build-deploy](https://github.com/supermanaaaa/harmonyos-build-deploy)** | HarmonyOS/鸿蒙 app build, sign, deploy to real devices, and APP packaging for AppGallery submission |
```

---

### 2. anthropics/skills (官方仓库)

**仓库**: https://github.com/anthropics/skills

**步骤**:
1. Fork 仓库
2. 将 `anthropic-skills/harmonyos-build-deploy/` 目录复制到 `skills/Development & Technical/`
3. 提交 PR

**PR 内容**: 见 `anthropic-skills-pr.md`

**文件结构**:
```
skills/Development & Technical/harmonyos-build-deploy/
└── SKILL.md
```

---

### 3. SkillsMP 市场

**网站**: https://skillsmp.com

**步骤**:
1. 注册账号
2. 点击 Submit/Publish
3. 填写 skill 信息
4. 上传 SKILL.md 或提供 GitHub 链接

---

### 4. Claude Code Commands Directory

**网站**: https://claudecodecommands.directory/submit

**步骤**:
1. 访问提交页面
2. 填写表单
3. 提供 GitHub 仓库链接

---

## 文件清单

| 文件 | 用途 |
|------|------|
| `awesome-claude-skills-pr.md` | awesome-claude-skills PR 说明 |
| `anthropic-skills-pr.md` | anthropics/skills PR 说明 |
| `anthropic-skills/harmonyos-build-deploy/SKILL.md` | 优化后的 SKILL.md (用于官方仓库) |

## 提交顺序建议

1. **先**: awesome-claude-skills (社区，审核快)
2. **然后**: SkillsMP 市场 (曝光度高)
3. **最后**: anthropics/skills (官方，审核严格)

## 注意事项

- 确保 GitHub 仓库是公开的
- npm 包已发布且可用
- SKILL.md 中的链接都有效
- description 要包含关键词便于搜索发现
