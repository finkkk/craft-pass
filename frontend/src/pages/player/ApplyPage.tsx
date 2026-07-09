import { useState, type FormEvent } from 'react';

interface Identity {
  qqNumber: string;
  minecraftId: string;
}

interface ApplyPageProps {
  initialValue: Identity;
  configLoading: boolean;
  questionCount?: number;
  passingScore?: number;
  onContinue: (identity: Identity) => void;
}

export function ApplyPage({
  initialValue,
  configLoading,
  questionCount,
  passingScore,
  onContinue,
}: ApplyPageProps) {
  const [formValue, setFormValue] = useState(initialValue);
  const [errors, setErrors] = useState<Partial<Identity>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Partial<Identity> = {};

    if (!/^[1-9][0-9]{4,11}$/.test(formValue.qqNumber)) {
      nextErrors.qqNumber = '请输入 5 至 12 位、且不以 0 开头的 QQ 号';
    }

    if (!/^[A-Za-z0-9_]{3,16}$/.test(formValue.minecraftId)) {
      nextErrors.minecraftId =
        '请输入 3 至 16 位英文、数字或下划线组成的正版 ID';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      onContinue(formValue);
    }
  }

  return (
    <section className="split-layout">
      <div className="intro-panel">
        <p className="eyebrow">WELCOME, TRAVELER</p>
        <h1>
          先读规则，
          <br />
          再进入世界。
        </h1>
        <p className="intro-copy">
          这是服务器白名单的唯一申请入口。请使用真实信息完成规则阅读和测试，审核通过后系统会自动处理入服资格。
        </p>

        <div className="feature-list">
          <div>
            <span>01</span>
            <p>
              <strong>阅读完整规则</strong>
              了解生存世界的共同边界
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              <strong>完成规则测试</strong>
              {questionCount && passingScore
                ? `${questionCount} 道单选题，达到 ${passingScore} 分合格`
                : '题目与合格线由服务器管理组配置'}
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              <strong>等待人工审核</strong>
              管理员确认后加入服务器白名单
            </p>
          </div>
        </div>
      </div>

      <div className="form-card">
        <div className="card-heading">
          <span className="card-icon" aria-hidden="true">⌁</span>
          <div>
            <p>STEP 01</p>
            <h2>填写申请资料</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="field-label" htmlFor="qq-number">
            QQ 号
            <span>用于管理员联系与身份确认</span>
          </label>
          <input
            id="qq-number"
            name="qqNumber"
            className={errors.qqNumber ? 'field-error' : ''}
            inputMode="numeric"
            autoComplete="off"
            placeholder="例如：123456789"
            value={formValue.qqNumber}
            onChange={(event) =>
              setFormValue((current) => ({
                ...current,
                qqNumber: event.target.value.trim(),
              }))
            }
            aria-describedby={errors.qqNumber ? 'qq-error' : undefined}
          />
          {errors.qqNumber ? (
            <p className="field-message" id="qq-error">{errors.qqNumber}</p>
          ) : null}

          <label className="field-label" htmlFor="minecraft-id">
            Minecraft ID
            <span>区分大小写，请与游戏内 ID 完全一致</span>
          </label>
          <input
            id="minecraft-id"
            name="minecraftId"
            className={errors.minecraftId ? 'field-error' : ''}
            autoComplete="off"
            placeholder="例如：Steve_01"
            value={formValue.minecraftId}
            onChange={(event) =>
              setFormValue((current) => ({
                ...current,
                minecraftId: event.target.value.trim(),
              }))
            }
            aria-describedby={
              errors.minecraftId ? 'minecraft-id-error' : undefined
            }
          />
          {errors.minecraftId ? (
            <p className="field-message" id="minecraft-id-error">
              {errors.minecraftId}
            </p>
          ) : null}

          <button
            className="primary-button full-width"
            type="submit"
            disabled={configLoading}
          >
            {configLoading ? '正在连接服务器…' : '下一步：阅读服务器规则'}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="privacy-note">
          <span aria-hidden="true">◆</span>
          提交时将记录 IP、浏览器信息和协议版本，仅用于审核与安全追溯。
        </p>
      </div>
    </section>
  );
}
