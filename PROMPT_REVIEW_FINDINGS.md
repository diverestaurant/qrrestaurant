# Dive Restaurant Master Prompt 审阅结论

审阅范围仅限原始 RTF Prompt；没有开始仓库审计、系统设计、编码、数据库或部署。

## 总体判断

原 Prompt 已经覆盖主要角色、核心流程、Multi-Tenant、RLS、状态机、测试和交付物，作为产品愿景非常完整。但它仍不是安全、稳定且可直接长期运行的 Autopilot 指令，主要原因是执行授权、UI 边界和真实运营异常尚未形成可验证规则。

## 最高优先级缺口

1. **审阅与执行冲突**：末尾“立即执行、不要停”会覆盖当前“只完善 Prompt”的意图，也可能在未来误触发仓库修改或生产动作。
2. **UI 没有架构边界**：只写“UI 可完成、移动优先”不足以保证日后换布局、品牌或组件库时不改数据库、RLS、状态机和业务逻辑。
3. **缺少独立 UI 负责人**：原 Prompt 允许主代理自主处理 UI，没有规定必须使用独立 UI/UX Subagent，也没有定义其输入、输出、权限和审阅时点。
4. **“简单易用”不可验收**：没有触控尺寸、可访问性、任务步骤、响应反馈、Web Vitals、真实设备或可用性测试门槛。
5. **真实运营异常界面不足**：KDS、Waiter、Cashier、Admin 缺少断线、重连、过期数据、并发冲突、误操作恢复、音频权限、错误分站、付款部分成功等页面状态。
6. **匿名顾客会话仍有安全歧义**：QR Token 与当前 Dining Session 的授权关系、谁开桌、多设备加入、旧链接失效和自动开桌滥用未定义。
7. **基础收银不够闭环**：未完整规定部分付款、混合付款、Void、Refund、Reopen、重复付款、收据编号与对账。
8. **Realtime 与事实来源未分开**：需要明确数据库提交才是事实，Realtime 只负责加速通知，并定义重复、乱序、遗漏和 resync。
9. **生产级声明过于宽泛**：缺少环境隔离、migration rollout、Go/No-Go、回滚、可观测性、用户验收和“Candidate/已部署/已试点”的状态区分。
10. **合规边界不足**：需要区分技术控制与 Malaysia PDPA、SST、Service Charge、Rounding、Receipt、E-Invoice 等由餐厅或专业顾问确认的事项。
11. **第一版范围可能失控**：需要 V1 Scope Matrix，明确转桌/并桌/拆桌、部分上菜、Split Bill、Takeaway 等是实现还是 Deferred，并写明人工替代流程。
12. **“未来接口”可能导致过度设计**：应只保留稳定 Port/Adapter 边界，不应提前构建没有真实用例的复杂模块。

## v2 已补上的控制

- `REVIEW_ONLY / PLAN_ONLY / BUILD / RELEASE` 四种运行模式，默认 `REVIEW_ONLY`。
- BUILD 与生产 RELEASE 分开授权，避免把本地完成误报为正式上线。
- UI Presentation Layer、Typed Contract、Import Boundary 和可替换性测试。
- 强制独立 UI/UX Design Subagent，并规定职责、交付物和禁止事项。
- `GREEN / YELLOW / RED` UI 变更分级，以及固定的 `UI ARCHITECTURE IMPACT WARNING`。
- 顾客端、KDS、Waiter、Cashier、Admin 的易用性和异常恢复标准。
- V1 Scope Matrix、匿名 Session 安全、Pricing/Payment、Realtime、隐私合规、CI/CD、Migration 和 Observability 补强。
- 严格区分 `Implemented`、`Verified in Staging`、`Production Ready Candidate`、`Deployed` 与 `Pilot Validated`。
- 新增唯一 `FINISH LINE`：分别定义 A（Production Ready Candidate）、B（正式部署）与 C（Pilot 验证），并要求 `/docs/FINISH_LINE.md` 逐项提供可复查证据。

## 建议保留的产品原则

- 金额只用整数最小货币单位。
- 最终价格由服务端重新计算。
- RLS 是数据库级租户隔离，不能只靠 UI 过滤。
- Order、Dining Session、Payment 使用显式状态机。
- 历史订单保存菜单、价格、Modifier 和税费快照。
- Idempotency、并发控制、Audit Log 和异常流程必须有自动化测试。
- 第一版不做完整 POS、Inventory 和 Accounting，但 Deferred 项必须有清晰边界与运营影响。

## 建议使用方法

日常审阅时保持：

`EXECUTION_MODE: REVIEW_ONLY`

需要只读审查仓库和制作计划时，由用户明确切换为：

`EXECUTION_MODE: PLAN_ONLY`

正式允许本地实现时，建议用户发送：

> 将 EXECUTION_MODE 切换为 BUILD，仅在指定项目目录内开始 M0；不得部署生产。

正式发布必须另行明确授权目标环境、项目和范围后才进入 `RELEASE`。
