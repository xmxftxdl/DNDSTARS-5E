import PublicWebsiteShell from '../components/PublicWebsiteShell'

type LegalKind = 'privacy' | 'terms'

const sections: Record<LegalKind, Array<{ title: string; paragraphs: string[] }>> = {
  privacy: [
    { title: '我们处理的数据', paragraphs: ['为提供账号和跨设备同步，我们会处理显示名称、登录邮箱或手机号、账号标识，以及你主动创建或上传的角色、战役、地图、聊天和扩展内容。语音功能启用时，音频会实时传输给语音服务商；除非明确开启录音或转录，我们不会把房间语音作为录音文件保存。'] },
    { title: '用途与共享', paragraphs: ['这些数据仅用于登录验证、房间同步、规则结算、内容存储、推送提醒、故障排查和你主动启用的服务。我们不会出售个人信息，也不会将数据用于跨应用广告追踪。必要数据只会提供给受约束的云主机、邮件、推送和语音基础设施服务商。'] },
    { title: '安全与保留', paragraphs: ['登录令牌在 iPhone Keychain 中保存；网络请求使用 HTTPS。账号内容保存到你删除账号或服务依法需要清理为止。依法必须保留的交易和安全审计记录会去标识化，并按适用期限保留。'] },
    { title: '你的选择', paragraphs: ['你可以在 APP 设置中修改资料、关闭推送、离开房间或永久删除账号。永久删除会移除登录凭证、个人资料、账号角色库、账号战役和账号级内容，无法撤销。已经分发到多人房间的共享快照属于房间共同内容，会由房间 DM 删除或随房间保留期清理，不会在删号时破坏其他成员的战役。若无法登录，可通过网站公布的支持渠道申请访问、更正或删除。'] },
    { title: '儿童与更新', paragraphs: ['本服务不面向未达到所在地数字服务同意年龄的儿童。政策发生实质变化时，我们会在网站或 APP 内提示并更新生效日期。'] },
  ],
  terms: [
    { title: '账号与使用', paragraphs: ['你应妥善保护账号凭证，并对账号下的操作负责。不得利用服务骚扰他人、破坏房间、绕过安全限制、批量消耗第三方资源或传播违法内容。'] },
    { title: '用户内容与扩展', paragraphs: ['你保留原创内容的权利，并授予平台为存储、同步、展示和交付该内容所必需的有限许可。上传者必须拥有内容的授权；收到有效侵权通知后，平台可以下架内容、冻结结算并要求补充权属材料。'] },
    { title: '规则资料与自动化', paragraphs: ['核心规则资料按页面标明的开放许可提供。Headless 自动结算用于辅助跑团，不替代 DM 的最终裁定。自定义插件仅能使用平台开放的声明式能力，不能执行任意页面脚本。'] },
    { title: '可用性与责任', paragraphs: ['开发测试阶段可能出现中断、兼容性变化或数据迁移。我们会采取合理措施保护数据并提供备份，但你仍应保留重要原创资料的副本。适用法律不允许排除的责任不受本条影响。'] },
    { title: '终止与联系', paragraphs: ['你可以随时在 APP 中删除账号并停止使用服务。严重违反条款或危及其他用户时，平台可限制或终止访问。条款更新会在生效前通过网站或 APP 提示。'] },
  ],
}

export default function PublicLegalPage({ kind }: { kind: LegalKind }) {
  const privacy = kind === 'privacy'
  return <PublicWebsiteShell>
    <main className="min-h-screen px-5 pb-24 pt-28 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">Astral Trace · 星痕</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-slate-100 sm:text-4xl">{privacy ? '隐私政策' : '服务条款'}</h1>
        <p className="mt-3 text-sm text-slate-500">生效日期：2026 年 8 月 15 日</p>
        <p className="mt-6 leading-7 text-slate-300">{privacy
          ? '本政策说明 Astral Trace 玩家端、网页端和多人房间如何处理信息。'
          : '使用 Astral Trace 即表示你同意遵守以下规则；未同意时请停止使用服务。'}</p>
        <div className="mt-9 space-y-8">
          {sections[kind].map((section) => <section key={section.title}>
            <h2 className="text-xl font-bold text-slate-100">{section.title}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 leading-7 text-slate-400">{paragraph}</p>)}
          </section>)}
        </div>
      </article>
    </main>
  </PublicWebsiteShell>
}
