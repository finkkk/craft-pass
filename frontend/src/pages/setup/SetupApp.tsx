import { useState, type FormEvent } from 'react';
import { completeSetup } from '../../api/setup';
import type { SetupStatus } from '../../types/setup';
import { BrandMark } from '../../components/BrandMark';

export function SetupApp({
  initialStatus,
}: {
  initialStatus: SetupStatus;
}) {
  const [completed, setCompleted] = useState(!initialStatus.setupRequired);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [form, setForm] = useState(() => ({
    setupToken: sessionStorage.getItem('craft_pass_setup_token') ?? '',
    siteName: 'Craft Pass',
    siteSubtitle: '服务器入服审核',
    adminUsername: 'admin',
    adminPassword: '',
    rconEnabled: false,
    rconHost: '127.0.0.1',
    rconPort: '25575',
    rconPassword: '',
    rconTimeoutMs: '5000',
    whitelistAddCommand: 'whitelist add {minecraftId}',
    whitelistReloadCommand: '',
  }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.adminPassword !== passwordConfirmation) {
      setError('两次输入的管理员密码不一致');
      return;
    }

    if (
      form.adminPassword.length < 8 ||
      !/[A-Za-z]/.test(form.adminPassword) ||
      !/[0-9]/.test(form.adminPassword)
    ) {
      setError('管理员密码至少 8 位，并且必须同时包含字母和数字');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await completeSetup({
        setupToken: form.setupToken.trim(),
        siteName: form.siteName.trim(),
        siteSubtitle: form.siteSubtitle.trim(),
        admin: {
          username: form.adminUsername.trim(),
          password: form.adminPassword,
        },
        rcon: {
          enabled: form.rconEnabled,
          host: form.rconHost.trim(),
          port: Number(form.rconPort),
          password: form.rconPassword,
          timeoutMs: Number(form.rconTimeoutMs),
          whitelistAddCommand: form.whitelistAddCommand.trim(),
          whitelistReloadCommand: form.whitelistReloadCommand.trim(),
        },
      });
      setForm((current) => ({
        ...current,
        setupToken: '',
        adminPassword: '',
        rconPassword: '',
      }));
      sessionStorage.removeItem('craft_pass_setup_token');
      setPasswordConfirmation('');
      setCompleted(true);
    } catch (setupError) {
      setError(
        setupError instanceof Error ? setupError.message : '部署初始化失败',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <main className="setup-complete">
        <div className="setup-complete-mark">✓</div>
        <p className="eyebrow">SETUP COMPLETE</p>
        <h1>Craft Pass 已完成初始化</h1>
        <p>
          部署入口已经锁定。现在可以使用刚刚创建的管理员账号登录后台。
        </p>
        <a className="primary-button" href="/admin/login">
          前往管理员登录
          <span>→</span>
        </a>
      </main>
    );
  }

  return (
    <main className="setup-shell">
      <header className="setup-header">
        <div className="admin-brand">
          <BrandMark className="admin-brand-mark" />
          CRAFT PASS
        </div>
        <p>FIRST-RUN DEPLOYMENT</p>
      </header>

      <div className="setup-layout">
        <aside className="setup-intro">
          <p className="eyebrow">WELCOME TO CRAFT PASS</p>
          <h1>第一次部署，从这里开始。</h1>
          <p>
            完成站点、管理员和 Minecraft RCON 设置。所有敏感信息只会发送到你的后端。
          </p>
          <ol>
            <li><span>01</span>站点基本信息</li>
            <li><span>02</span>首个管理员账号</li>
            <li><span>03</span>RCON 与白名单命令</li>
            <li><span>04</span>一次性部署令牌确认</li>
          </ol>
          <div className="setup-security-note">
            部署令牌显示在后端启动控制台中。初始化成功后，令牌和本页面会立即失效。
          </div>
        </aside>

        <form className="setup-form" onSubmit={handleSubmit}>
          {error ? <div className="admin-form-error">{error}</div> : null}

          <SetupSection number="01" title="站点信息">
            <div className="setup-field-grid">
              <SetupField label="站点名称">
                <input
                  value={form.siteName}
                  minLength={2}
                  maxLength={60}
                  onChange={(event) =>
                    setForm({ ...form, siteName: event.target.value })
                  }
                  required
                />
              </SetupField>
              <SetupField label="站点副标题">
                <input
                  value={form.siteSubtitle}
                  minLength={2}
                  maxLength={100}
                  onChange={(event) =>
                    setForm({ ...form, siteSubtitle: event.target.value })
                  }
                  required
                />
              </SetupField>
            </div>
          </SetupSection>

          <SetupSection number="02" title="管理员账号">
            <SetupField label="管理员用户名">
              <input
                autoComplete="username"
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_-]{3,32}"
                title="请输入 3 至 32 位英文、数字、下划线或连字符"
                value={form.adminUsername}
                onChange={(event) =>
                  setForm({ ...form, adminUsername: event.target.value })
                }
                required
              />
            </SetupField>
            <div className="setup-field-grid">
              <SetupField
                label="管理员密码"
                help="至少 8 位，并且同时包含字母和数字"
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={form.adminPassword}
                  onChange={(event) =>
                    setForm({ ...form, adminPassword: event.target.value })
                  }
                  required
                />
              </SetupField>
              <SetupField label="再次确认密码">
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={passwordConfirmation}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                  required
                />
              </SetupField>
            </div>
          </SetupSection>

          <SetupSection number="03" title="Minecraft RCON">
            <label className="setup-toggle">
              <input
                type="checkbox"
                checked={form.rconEnabled}
                onChange={(event) =>
                  setForm({ ...form, rconEnabled: event.target.checked })
                }
              />
              <span />
              <p>
                <strong>现在启用 RCON</strong>
                也可以暂时关闭，之后再通过配置管理页面启用
              </p>
            </label>

            <div className="setup-field-grid three">
              <SetupField label="RCON 主机">
                <input
                  value={form.rconHost}
                  maxLength={255}
                  onChange={(event) =>
                    setForm({ ...form, rconHost: event.target.value })
                  }
                  required
                />
              </SetupField>
              <SetupField label="端口">
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={form.rconPort}
                  onChange={(event) =>
                    setForm({ ...form, rconPort: event.target.value })
                  }
                  required
                />
              </SetupField>
              <SetupField label="超时（毫秒）">
                <input
                  type="number"
                  min="500"
                  max="30000"
                  value={form.rconTimeoutMs}
                  onChange={(event) =>
                    setForm({ ...form, rconTimeoutMs: event.target.value })
                  }
                  required
                />
              </SetupField>
            </div>

            <SetupField label="RCON 密码">
              <input
                type="password"
                autoComplete="new-password"
                minLength={form.rconEnabled ? 8 : undefined}
                maxLength={256}
                value={form.rconPassword}
                onChange={(event) =>
                  setForm({ ...form, rconPassword: event.target.value })
                }
                required={form.rconEnabled}
              />
            </SetupField>

            <SetupField
              label="加入白名单命令"
              help="必须保留 {minecraftId} 占位符"
            >
              <input
                className="code-input"
                maxLength={200}
                value={form.whitelistAddCommand}
                onChange={(event) =>
                  setForm({
                    ...form,
                    whitelistAddCommand: event.target.value,
                  })
                }
                required
              />
            </SetupField>

            <SetupField
              label="刷新命令（可选）"
              help="留空表示不执行第二条命令"
            >
              <input
                className="code-input"
                placeholder="whitelist reload"
                maxLength={200}
                value={form.whitelistReloadCommand}
                onChange={(event) =>
                  setForm({
                    ...form,
                    whitelistReloadCommand: event.target.value,
                  })
                }
              />
            </SetupField>
          </SetupSection>

          <SetupSection number="04" title="部署确认">
            <SetupField
              label="一次性部署令牌"
              help="复制后端启动控制台中显示的令牌"
            >
              <input
                className="code-input"
                autoComplete="off"
                minLength={16}
                maxLength={256}
                value={form.setupToken}
                onChange={(event) =>
                  setForm({ ...form, setupToken: event.target.value })
                }
                required
              />
            </SetupField>
          </SetupSection>

          <button
            className="primary-button setup-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? '正在初始化…' : '保存配置并完成部署'}
            <span>→</span>
          </button>
        </form>
      </div>
    </main>
  );
}

function SetupSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="setup-section">
      <header>
        <span>{number}</span>
        <h2>{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function SetupField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="setup-field">
      <span>{label}</span>
      {children}
      {help ? <small>{help}</small> : null}
    </label>
  );
}
