import { useEffect, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  getAdminContent,
  getAdminSession,
  updateAdminRulesQuizContent,
} from '../../api/admin';
import type {
  AdminContentConfig,
  AdminIdentity,
} from '../../types/admin';
import { AdminSidebar } from './AdminSidebar';

const optionIds = ['A', 'B', 'C', 'D', 'E', 'F'];

export function AdminContentPage() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [content, setContent] = useState<AdminContentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAdminSession(), getAdminContent()])
      .then(([session, loadedContent]) => {
        setAdmin(session.admin);
        setContent(loadedContent);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof AdminApiError && loadError.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        setError(getMessage(loadError));
      });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const normalized = normalizeContent(content);
      setContent(
        await updateAdminRulesQuizContent({
          agreement: normalized.agreement,
          quiz: normalized.quiz,
        }),
      );
      setMessage('服规与题库已保存，玩家刷新页面后立即生效。');
    } catch (saveError) {
      setError(getMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function updateSection(
    index: number,
    update: Partial<AdminContentConfig['agreement']['sections'][number]>,
  ) {
    setContent((current) => {
      if (!current) return current;
      const sections = [...current.agreement.sections];
      sections[index] = { ...sections[index]!, ...update };
      return {
        ...current,
        agreement: { ...current.agreement, sections },
      };
    });
  }

  function updateQuestion(
    index: number,
    update: Partial<AdminContentConfig['quiz']['questions'][number]>,
  ) {
    setContent((current) => {
      if (!current) return current;
      const questions = [...current.quiz.questions];
      questions[index] = { ...questions[index]!, ...update };
      return { ...current, quiz: { ...current.quiz, questions } };
    });
  }

  return (
    <div className="admin-shell">
      <AdminSidebar admin={admin} active="content" />

      <main className="admin-main content-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">CONTENT MANAGEMENT</p>
            <h1>题库与服规</h1>
          </div>
          <span className="rcon-online">
            {content ? `${content.quiz.questions.length} 道题` : '读取中'}
          </span>
        </header>

        {error ? <div className="admin-form-error">{error}</div> : null}
        {message ? <div className="settings-success">{message}</div> : null}

        {!content ? (
          <div className="settings-loading">正在读取服规与题库…</div>
        ) : (
          <form className="content-form" onSubmit={handleSubmit}>
            <section className="content-panel">
              <header>
                <div>
                  <p className="eyebrow">SERVER RULES</p>
                  <h2>入服协议与服规</h2>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    setContent({
                      ...content,
                      agreement: {
                        ...content.agreement,
                        sections: [
                          ...content.agreement.sections,
                          {
                            id: createContentId('section'),
                            title: '新章节',
                            paragraphs: ['请填写规则内容'],
                          },
                        ],
                      },
                    })
                  }
                >
                  添加章节
                </button>
              </header>

              <div className="content-grid two">
                <ContentField
                  label="协议版本"
                >
                  <input
                    maxLength={64}
                    value={content.agreement.version}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        agreement: {
                          ...content.agreement,
                          version: event.target.value,
                        },
                      })
                    }
                    required
                  />
                </ContentField>
                <ContentField label="协议标题">
                  <input
                    maxLength={100}
                    value={content.agreement.title}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        agreement: {
                          ...content.agreement,
                          title: event.target.value,
                        },
                      })
                    }
                    required
                  />
                </ContentField>
              </div>
              <p className="content-version-note">
                修改规则或题目时，建议同步更新协议版本号。
              </p>

              <div className="rule-section-list">
                {content.agreement.sections.map((section, index) => (
                  <article key={section.id}>
                    <header>
                      <strong>章节 {index + 1}</strong>
                      <button
                        type="button"
                        disabled={content.agreement.sections.length === 1}
                        onClick={() =>
                          setContent({
                            ...content,
                            agreement: {
                              ...content.agreement,
                              sections: content.agreement.sections.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            },
                          })
                        }
                      >
                        删除
                      </button>
                    </header>
                    <ContentField label="章节标题">
                      <input
                        maxLength={100}
                        value={section.title}
                        onChange={(event) =>
                          updateSection(index, { title: event.target.value })
                        }
                        required
                      />
                    </ContentField>
                    <ContentField
                      label="规则段落"
                      help="每行作为一个独立段落"
                    >
                      <textarea
                        value={section.paragraphs.join('\n')}
                        onChange={(event) =>
                          updateSection(index, {
                            paragraphs: lines(event.target.value),
                          })
                        }
                        required
                      />
                    </ContentField>
                  </article>
                ))}
              </div>

              <ContentField
                label="签署确认声明"
                help="每行一条，玩家提交前需要确认"
              >
                <textarea
                  value={content.agreement.signatureStatements.join('\n')}
                  onChange={(event) =>
                    setContent({
                      ...content,
                      agreement: {
                        ...content.agreement,
                        signatureStatements: lines(event.target.value),
                      },
                    })
                  }
                  required
                />
              </ContentField>
            </section>

            <section className="content-panel">
              <header>
                <div>
                  <p className="eyebrow">QUIZ BANK</p>
                  <h2>单选题题库</h2>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    setContent({
                      ...content,
                      quiz: {
                        ...content.quiz,
                        questions: [
                          ...content.quiz.questions,
                          {
                            id: createContentId('q'),
                            prompt: '请输入题目',
                            options: [
                              { id: 'A', text: '选项 A' },
                              { id: 'B', text: '选项 B' },
                            ],
                            correctOptionId: 'A',
                          },
                        ],
                      },
                    })
                  }
                >
                  添加题目
                </button>
              </header>

              <div className="content-grid two">
                <ContentField
                  label="合格分数"
                  help="范围 1 至 100 分，由后端统一判分"
                >
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={content.quiz.passingScore}
                    onChange={(event) =>
                      setContent({ ...content, quiz: { ...content.quiz, passingScore: Number(event.target.value) } })
                    }
                    required
                  />
                </ContentField>
                <ContentField
                  label="每次随机抽题数"
                  help="留空表示使用全部题目；不能超过题库总数"
                >
                  <input
                    type="number"
                    min={1}
                    max={content.quiz.questions.length}
                    value={content.quiz.randomQuestionCount ?? ''}
                    placeholder={`全部 ${content.quiz.questions.length} 题`}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        quiz: {
                          ...content.quiz,
                          randomQuestionCount: event.target.value
                            ? Number(event.target.value)
                            : null,
                        },
                      })
                    }
                  />
                </ContentField>
              </div>

              <div className="question-editor-list">
                {content.quiz.questions.map((question, questionIndex) => (
                  <article className="question-editor" key={question.id}>
                    <header>
                      <span>{questionIndex + 1}</span>
                      <strong>单选题</strong>
                      <button
                        type="button"
                        disabled={content.quiz.questions.length === 1}
                        onClick={() =>
                          setContent({
                            ...content,
                            quiz: {
                              ...content.quiz,
                              questions: content.quiz.questions.filter(
                                (_, index) => index !== questionIndex,
                              ),
                            },
                          })
                        }
                      >
                        删除题目
                      </button>
                    </header>
                    <ContentField label="题目内容">
                      <textarea
                        value={question.prompt}
                        onChange={(event) =>
                          updateQuestion(questionIndex, {
                            prompt: event.target.value,
                          })
                        }
                        required
                      />
                    </ContentField>

                    <div className="option-editor-list">
                      {question.options.map((option, optionIndex) => (
                        <div key={option.id}>
                          <label
                            className="correct-option"
                            title="选择为正确答案"
                          >
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={
                                question.correctOptionId === option.id
                              }
                              onChange={() =>
                                updateQuestion(questionIndex, {
                                  correctOptionId: option.id,
                                })
                              }
                            />
                            <span>{option.id}</span>
                          </label>
                          <input
                            value={option.text}
                            maxLength={200}
                            onChange={(event) => {
                              const options = [...question.options];
                              options[optionIndex] = {
                                ...option,
                                text: event.target.value,
                              };
                              updateQuestion(questionIndex, { options });
                            }}
                            required
                          />
                          <button
                            type="button"
                            disabled={question.options.length === 2}
                            onClick={() => {
                              const options = question.options.filter(
                                (_, index) => index !== optionIndex,
                              );
                              updateQuestion(questionIndex, {
                                options,
                                correctOptionId:
                                  question.correctOptionId === option.id
                                    ? options[0]!.id
                                    : question.correctOptionId,
                              });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      className="add-option-button"
                      type="button"
                      disabled={question.options.length >= 6}
                      onClick={() => {
                        const nextId = optionIds.find(
                          (id) =>
                            !question.options.some(
                              (option) => option.id === id,
                            ),
                        );
                        if (!nextId) return;
                        updateQuestion(questionIndex, {
                          options: [
                            ...question.options,
                            { id: nextId, text: `选项 ${nextId}` },
                          ],
                        });
                      }}
                    >
                      添加选项
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <footer className="content-save-bar">
              <p>
                正确答案只保存在后端配置中，不会通过玩家题目接口返回。
              </p>
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? '正在保存…' : '保存服规与题库'}
                <span>→</span>
              </button>
            </footer>
          </form>
        )}
      </main>
    </div>
  );
}

const uiFieldGroups = [
  {
    id: 'navigation',
    title: '导航与页脚',
    fields: [
      ['systemStatus', '右上角系统状态', 24],
      ['stepIdentity', '步骤一名称', 12],
      ['stepAgreement', '步骤二名称', 12],
      ['stepQuiz', '步骤三名称', 12],
      ['stepResult', '步骤四名称', 12],
      ['footerPrimary', '页脚左侧文字', 60],
      ['footerSecondary', '页脚右侧文字', 60],
    ],
  },
  {
    id: 'apply',
    title: '申请资料页',
    fields: [
      ['eyebrow', '页面眉题', 40],
      ['title', '主标题', 40],
      ['intro', '页面介绍', 240, true],
      ['featureOneTitle', '流程一标题', 24],
      ['featureOneDescription', '流程一说明', 60],
      ['featureTwoTitle', '流程二标题', 24],
      ['featureTwoDescription', '流程二备用说明', 60],
      ['featureTwoConfigured', '流程二动态说明', 80],
      ['featureThreeTitle', '流程三标题', 24],
      ['featureThreeDescription', '流程三说明', 60],
      ['stepLabel', '表单步骤标签', 20],
      ['formTitle', '表单标题', 30],
      ['qqLabel', 'QQ 字段名', 20],
      ['qqHelp', 'QQ 输入提示', 60],
      ['qqPlaceholder', 'QQ 占位文字', 30],
      ['qqInvalidMessage', 'QQ 错误提示', 80],
      ['minecraftLabel', 'Minecraft 字段名', 30],
      ['minecraftHelp', 'Minecraft ID 输入提示', 80],
      ['minecraftPlaceholder', 'Minecraft ID 占位文字', 30],
      ['minecraftInvalidMessage', 'Minecraft ID 错误提示', 100],
      ['loadingButton', '加载中按钮', 30],
      ['continueButton', '继续按钮', 30],
      ['privacyNote', '隐私说明', 160, true],
    ],
  },
  {
    id: 'agreement',
    title: '规则阅读页',
    fields: [
      ['eyebrow', '页面眉题', 40],
      ['intro', '规则页介绍', 240, true],
      ['versionPrefix', '版本号前缀', 12],
      ['noticeTitle', '阅读提示标题', 20],
      ['noticeBody', '阅读提示内容', 200, true],
      ['signatureTitle', '签署区标题', 30],
      ['acceptanceLabel', '勾选确认文字', 80],
      ['backButton', '返回按钮', 30],
      ['continueButton', '开始测试按钮', 30],
    ],
  },
  {
    id: 'quiz',
    title: '规则测试页',
    fields: [
      ['eyebrow', '页面眉题', 40],
      ['title', '测试标题', 40],
      ['intro', '测试说明', 160, true],
      ['passingScoreLabel', '合格分数标签', 20],
      ['fullScoreLabel', '满分标签', 20],
      ['backRulesButton', '返回规则按钮', 24],
      ['previousButton', '上一题按钮', 24],
      ['nextButton', '下一题按钮', 24],
      ['submittingButton', '提交中按钮', 30],
      ['unansweredButton', '未答题提示按钮', 40],
      ['answeredCountLabel', '已答数量标签', 20],
      ['submitButton', '提交按钮', 30],
    ],
  },
  {
    id: 'result',
    title: '申请结果页',
    fields: [
      ['eyebrow', '页面眉题', 40],
      ['passedTitle', '通过测试标题', 50],
      ['failedTitle', '未通过测试标题', 50],
      ['passedDescription', '通过测试说明', 200, true],
      ['failedDescription', '未通过测试说明', 200, true],
      ['minecraftLabel', 'Minecraft 字段名', 30],
      ['qqLabel', 'QQ 字段名', 20],
      ['statusLabel', '状态字段名', 30],
      ['applicationIdLabel', '申请编号字段名', 30],
      ['pendingStatus', '等待审核状态文字', 30],
      ['failedStatus', '未通过状态文字', 30],
      ['notice', '审核提示', 160, true],
      ['retryButton', '重新阅读按钮', 30],
    ],
  },
] as const;

export function UiCopyEditor({
  content,
  onChange,
}: {
  content: AdminContentConfig;
  onChange: (content: AdminContentConfig) => void;
}) {
  function updateField(
    sectionId: (typeof uiFieldGroups)[number]['id'],
    fieldId: string,
    value: string,
  ) {
    const section = content.ui[sectionId] as unknown as Record<string, string>;
    onChange({
      ...content,
      ui: {
        ...content.ui,
        [sectionId]: { ...section, [fieldId]: value },
      },
    } as AdminContentConfig);
  }

  return (
    <section className="content-panel ui-copy-panel">
      <header>
        <div>
          <p className="eyebrow">PLAYER INTERFACE</p>
          <h2>玩家端界面文案</h2>
        </div>
        <span>共 {uiFieldGroups.length} 组</span>
      </header>
      <p className="content-version-note">
        所有字段均设置了字数上限，以免过长文字破坏桌面端与手机端布局。
        动态说明可使用 {'{count}'} 与 {'{score}'} 占位符。
      </p>
      <div className="ui-copy-groups">
        {uiFieldGroups.map((group, groupIndex) => {
          const values = content.ui[group.id] as unknown as Record<
            string,
            string
          >;
          return (
            <details key={group.id} open={groupIndex === 0}>
              <summary>
                <strong>{group.title}</strong>
                <span>{group.fields.length} 项</span>
              </summary>
              <div className="ui-copy-fields">
                {group.fields.map(([id, label, maxLength, multiline]) => (
                  <ContentField
                    key={id}
                    label={`${label}（最多 ${maxLength} 字）`}
                  >
                    {multiline ? (
                      <textarea
                        maxLength={maxLength}
                        value={values[id] ?? ''}
                        onChange={(event) =>
                          updateField(group.id, id, event.target.value)
                        }
                        required
                      />
                    ) : (
                      <input
                        maxLength={maxLength}
                        value={values[id] ?? ''}
                        onChange={(event) =>
                          updateField(group.id, id, event.target.value)
                        }
                        required
                      />
                    )}
                  </ContentField>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function ContentField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="content-field">
      <span>{label}</span>
      {children}
      {help ? <small>{help}</small> : null}
    </label>
  );
}

function lines(value: string) {
  return value.split(/\r?\n/);
}

function normalizeContent(content: AdminContentConfig): AdminContentConfig {
  return {
    ui: content.ui,
    agreement: {
      ...content.agreement,
      version: content.agreement.version.trim(),
      title: content.agreement.title.trim(),
      sections: content.agreement.sections.map((section) => ({
        ...section,
        title: section.title.trim(),
        paragraphs: section.paragraphs
          .map((paragraph) => paragraph.trim())
          .filter(Boolean),
      })),
      signatureStatements: content.agreement.signatureStatements
        .map((statement) => statement.trim())
        .filter(Boolean),
    },
    quiz: {
      ...content.quiz,
      randomQuestionCount:
        content.quiz.randomQuestionCount === null
          ? null
          : Math.min(
              content.quiz.randomQuestionCount,
              content.quiz.questions.length,
            ),
      questions: content.quiz.questions.map((question) => ({
        ...question,
        prompt: question.prompt.trim(),
        options: question.options.map((option) => ({
          ...option,
          text: option.text.trim(),
        })),
      })),
    },
  };
}

function createContentId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : '无法保存服规与题库';
}
