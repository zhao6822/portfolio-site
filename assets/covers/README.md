---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 9d28daf1a7d9923eabbd286698e5ff78_c5d635e9b26e11f19c7a525400de85a5
    ReservedCode1: XU5Cv14G7i5Yj+uIoSLnv3oROlunu0Npo1S0Fk2R0WSPAMglMLJTN+CdeXY+v8ylVmn8aujgqgvw+hHDxx0Gszdxvzcp+0TF4az2Hih4PrP7BNrnc/+NHas/StQYY1xtfh34k+dfFub/8liH3VpXHofB79x8o+Eooi9jv2r9o3KtgJNtSLgqAxIE9HE=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 9d28daf1a7d9923eabbd286698e5ff78_c5d635e9b26e11f19c7a525400de85a5
    ReservedCode2: XU5Cv14G7i5Yj+uIoSLnv3oROlunu0Npo1S0Fk2R0WSPAMglMLJTN+CdeXY+v8ylVmn8aujgqgvw+hHDxx0Gszdxvzcp+0TF4az2Hih4PrP7BNrnc/+NHas/StQYY1xtfh34k+dfFub/8liH3VpXHofB79x8o+Eooi9jv2r9o3KtgJNtSLgqAxIE9HE=
---

# 封面图目录（assets/covers/）

把作品的封面图放在本目录下，然后在 `assets/js/data.js` 中把对应作品的 `cover` 字段写成这里的相对路径。

## 命名建议

- 与作品 `id` 同名：`auto-brand-film-north.jpg` ← 对应 `id: "auto-brand-film-north"`
- 只用英文小写字母、数字与中划线，不要包含空格与中文，避免不同系统下路径解析差异。

## 规格建议

| 项目 | 建议值 |
| --- | --- |
| 画面比例 | 16:9 |
| 尺寸 | 1920×1080（首页网格卡片与详情页共用） |
| 格式 | jpg（照片类）/ png（含文字版式类） |
| 文件大小 | 单张 500KB 以内 |

## 无图时的表现（自动降级，不会出现破图）

- `cover` 字段留空字符串 `""`；或
- `cover` 指向的图片不存在、路径写错、加载失败。

以上情况卡片会自动显示**渐变占位封面**：一块由作品 `id` 计算出的渐变色背景，上面标注作品类型与片名。同一件作品的占位配色固定不变，替换成真实封面后自动生效，无需改动其他文件。

## 当前状态

现有 10 件示例作品均尚未放入实际封面图，页面以渐变占位封面展示。若要启用真实封面，按上面的命名规则放入图片并更新 `data.js` 中对应的 `cover` 路径即可（建议图片格式统一为 jpg）。
*（内容由AI生成，仅供参考）*
