export type QuizOptionId = 'A' | 'B' | 'C' | 'D';

export interface QuizOption {
  id: QuizOptionId;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: readonly QuizOption[];
  correctOptionId: QuizOptionId;
}

export const passingScore = 80;

export const quizQuestions: readonly QuizQuestion[] = [
  {
    id: 'q1',
    prompt: '服务器是否允许使用矿透材质、矿透模组或类似功能？',
    options: [
      { id: 'A', text: '只要不被发现就可以' },
      { id: 'B', text: '仅挖矿时可以' },
      { id: 'C', text: '禁止使用' },
      { id: 'D', text: '进入服务器三天后可以' },
    ],
    correctOptionId: 'C',
  },
  {
    id: 'q2',
    prompt: '发现可能复制物品的服务器漏洞时，正确做法是什么？',
    options: [
      { id: 'A', text: '停止利用并私下报告管理员' },
      { id: 'B', text: '先大量复制再报告' },
      { id: 'C', text: '公开教程让大家测试' },
      { id: 'D', text: '出售给其他玩家' },
    ],
    correctOptionId: 'A',
  },
  {
    id: 'q3',
    prompt: '未经允许，可以拿取他人箱子中的物品或修改他人建筑吗？',
    options: [
      { id: 'A', text: '可以，未上锁就代表允许' },
      { id: 'B', text: '只可以拿少量物品' },
      { id: 'C', text: '管理员不在线时可以' },
      { id: 'D', text: '不可以' },
    ],
    correctOptionId: 'D',
  },
  {
    id: 'q4',
    prompt: '红石机器、刷怪塔和自动化装置应遵循什么原则？',
    options: [
      { id: 'A', text: '可以无限扩建并永久运行' },
      { id: 'B', text: '遵守服务器规模和运行限制，不得造成卡顿' },
      { id: 'C', text: '只要建得隐蔽就不受限制' },
      { id: 'D', text: '只限制新玩家' },
    ],
    correctOptionId: 'B',
  },
  {
    id: 'q5',
    prompt: '与其他玩家发生物品或建筑纠纷时，应该怎么处理？',
    options: [
      { id: 'A', text: '保留证据并联系管理员处理' },
      { id: 'B', text: '立即破坏对方建筑作为补偿' },
      { id: 'C', text: '在公共频道持续辱骂对方' },
      { id: 'D', text: '使用小号报复' },
    ],
    correctOptionId: 'A',
  },
  {
    id: 'q6',
    prompt: '是否可以使用未经管理组允许的自动挂机或自动操作脚本？',
    options: [
      { id: 'A', text: '每天可以使用一小时' },
      { id: 'B', text: '只在深夜可以使用' },
      { id: 'C', text: '不可以' },
      { id: 'D', text: '充值后可以使用' },
    ],
    correctOptionId: 'C',
  },
  {
    id: 'q7',
    prompt: '发现其他玩家疑似违规时，合适的做法是什么？',
    options: [
      { id: 'A', text: '公开传播对方使用的方法' },
      { id: 'B', text: '保留证据并通过管理渠道举报' },
      { id: 'C', text: '直接盗取对方物品作为处罚' },
      { id: 'D', text: '组织其他玩家围攻' },
    ],
    correctOptionId: 'B',
  },
  {
    id: 'q8',
    prompt: '在普通区域发起 PVP，通常需要满足什么条件？',
    options: [
      { id: 'A', text: '对方装备比自己好' },
      { id: 'B', text: '管理员不在线' },
      { id: 'C', text: '自己先发出警告即可' },
      { id: 'D', text: '双方同意，或处于服务器明确允许的区域' },
    ],
    correctOptionId: 'D',
  },
  {
    id: 'q9',
    prompt: '故意制造卡服装置或持续运行明显造成卡顿的机器，会怎样处理？',
    options: [
      { id: 'A', text: '可能被拆除装置并受到进一步处罚' },
      { id: 'B', text: '只要是红石装置就不会处罚' },
      { id: 'C', text: '仅第一次完全免责' },
      { id: 'D', text: '服务器必须补偿建造材料' },
    ],
    correctOptionId: 'A',
  },
  {
    id: 'q10',
    prompt: '违反服务器规则可能产生什么后果？',
    options: [
      { id: 'A', text: '最多收到口头提醒' },
      { id: 'B', text: '只有其他玩家投票后才能处理' },
      { id: 'C', text: '可能被警告、回档、封禁或移出白名单' },
      { id: 'D', text: '通过答题后不再受规则约束' },
    ],
    correctOptionId: 'C',
  },
] as const;

export function getPublicQuizQuestions() {
  return quizQuestions.map(({ correctOptionId: _correctOptionId, ...question }) => ({
    ...question,
    options: question.options.map((option) => ({ ...option })),
  }));
}
