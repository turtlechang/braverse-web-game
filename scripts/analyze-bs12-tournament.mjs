import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const report = JSON.parse(await readFile('data/decks/bs12-1028-report.json', 'utf8'))
assert.equal(report.status, 'PASS')
const holdout = JSON.parse(await readFile('output/bs12-1028/holdout.json', 'utf8'))
const verification = JSON.parse(await readFile('output/bs12-1028/verification-evidence.json', 'utf8'))
assert.equal(verification.status, 'PASS')
const colors = ['blue', 'green', 'yellow', 'red', 'purple', 'black']
const names = { blue: '藍', green: '綠', yellow: '黃', red: '紅', purple: '紫', black: '黑' }
const roster = JSON.parse(await readFile('data/decks/bs12-1028-roster.json', 'utf8'))
const byId = new Map(roster.decks.map(deck => [deck.id, deck]))
const valid = report.swiss.matches.filter(match => match.result === 'win')
const pct = (count, total) => total ? `${(count / total * 100).toFixed(2)}%` : '—'
const matchup = (left, right) => {
  const rows = valid.filter(row => {
    const a = byId.get(row.playerOneDeckId).color, b = byId.get(row.playerTwoDeckId).color
    return (a === left && b === right) || (a === right && b === left)
  })
  const wins = rows.filter(row => byId.get(row.winnerDeckId).color === left).length
  return { games: rows.length, wins, rate: pct(wins, rows.length) }
}
const plans = {
  blue: {
    strength: 'Marbleberry能把LV.2以下對手放牌庫底；CAKE POPs與Popping Candy提供減傷及續航，Dark Choco能多次攻擊。',
    weakness: '放底控制不能直接處理LV.3以上核心；底牌需要符合LV.2且Arena。重置Cookie並不重置支援，連攻會受能量及Arena手牌限制。',
    plan: '前期以兩費攻擊與FLIP補牌穩住，保留一張藍色Arena作Marbleberry代價。用Cream Soda／Raspberry Mousse的放底動作建立Popping Candy入口，與CAKE POPs配對。Dark Choco完整兩次攻擊加Activate需要五張可用支援及手牌≤5，先計算再發動。',
    next: '對黑色高LV核心改以低LV前置、分散傷害與打斷Special Play鏈爭取節奏；不能假設放底能解所有大型餅乾。',
  },
  green: {
    strength: 'Trophy／Strawberry Crepe提供支援成長，Stadium／Pudding從支援登場，Choco Drizzle可造成登場傷害；Mystic Flour可處理雙目標HP。',
    weakness: '支援同時是登場、攻擊與技能代價，退回／棄置後可能失去火力。主牌沒有White Lily或Special Play餅乾，因此BS10-073與BS12-111缺少登場來源；沒有Candy Apple使Apple Faerie依賴七綠支援。',
    plan: '開局優先建立支援，維持能支付下一次攻擊的底線。從支援登場Choco Drizzle才會觸發2傷；不要把手牌登場當成同一收益。Mystic Flour先攻擊、再以第三張活躍支援付G並回收兩張已疲勞支援，之後立即安排補回資源。',
    next: '達到七張支援前先評估對手Poison Mushroom門檻；目前真正可達成的Extra以Peak of Apathy／Shadow Milk等條件為主。替換兩個無法建立來源的Extra是構築候選，尚未做換牌對照。',
  },
  yellow: {
    strength: 'Madeleine／Kouign-Amann／Clotted Cream把Arena休息區累積轉成傷害、補HP與Extra入口，Choux被Arena效果送休息區可提供補HP。',
    weakness: '主動把Cookie放休息區也增加敗北風險；四Arena門檻、手牌代價及後續回收需要精確排序。不能為了湊門檻不計休息區LV。',
    plan: '優先以低LV的Arena付款，送Choux後完成目前效果鏈再結算補HP。四張Arena門檻成立後再兌現Madeleine增傷、Financier技能與BS12 Clotted Cream。低HP時保留陷阱能量，避免把所有手牌送去休息區。',
    next: '黃色等待效果卡住已修復，這是可用性改善；比賽表現仍須看同牌表對照，不能把主動送休息區一律視為壞動作。',
  },
  red: {
    strength: 'Strawberry Mochi／Shining Glitter／Shiningberry提供活躍與連攻；Producer Mic裝備Shining Glitter後可封鎖該戰鬥的FLIP。',
    weakness: 'Strawberry Crepe只有1HP；Crepe與Parfait在沒有另一張Arena時不會於活躍階段自然活躍。三至四費攻擊的多次出手需要大量支援。',
    plan: '維持兩張Arena構成，先計算支援能付幾次攻擊，再安排活躍來源；不要只因有活躍技能就先把能量用光。用低費攻擊試探，再讓Mic裝備宿主處理關鍵FLIP防線；達休息區LV4後才規劃Shining Glitter Extra。',
    next: '面對紫色Blocker需計算被轉移的攻擊與手牌交換；單體大型攻擊之外，利用追加傷害及多次出手，避免讓1HP核心裸站。',
  },
  purple: {
    strength: 'Blocker可重分配承傷；Werewolf與LV.3對手交戰可封攻擊後效果，Milky Way／Caramel Arrow提供休息區調整與回收。',
    weakness: '每次Blocker需要紫色Arena手牌；防守與昏厥能力會共同消耗手牌、牌庫與休息區容量。Black Lemonade需要三張Arena Blocker休息區及額外場上代價。',
    plan: '保留可支付Blocker的Arena手牌，針對致命或高收益攻擊攔截，避免每次都交代價。按Milky Way／Caramel Arrow的門檻規劃回收與休息區降壓，再用Black Lemonade轉成對手棄牌壓力。',
    next: 'Werewolf的封鎖限定對方LV.3攻擊效果，不能當成對覺醒LV.5黑色的通用免疫；對多次小傷需留足手牌。',
  },
  black: {
    strength: '低LV Special Play與Cake Hound／Pomegranate回收形成替換鏈；Poison Mushroom在對手四支援時可登場並加強其他黑Arena傷害，大型Dark Enchantress有高傷害終結能力。',
    weakness: '需要正確保留Special Play來源、手牌與場面；大型Dark Enchantress或覺醒體倒下會增加大量休息區LV，磨牌與回收也可能加快Refresh。',
    plan: '先以低費Cake Hound與Schwarzwälder建立節奏和手牌，保留一個Special Play來源。對手達四支援時評估Poison Mushroom；Licorice只有手牌真有Special Play餅乾才選HP放置。Red Velvet自棄回收前保留其他身體，再考慮城堡與Dark Enchantress覺醒終結。',
    next: '不要把所有回收都當收益；確認剩餘牌庫及下一回合能量。Venom已離場時略過補HP可選代價，避免失敗及無效棄牌。',
  },
}
const rows = report.top16.map(row => `| ${row.rank} | ${row.name} | ${row.points} | ${row.wins}-${row.losses} | ${row.buchholz} |`)
const summary = colors.map(color => {
  const s = report.perColor[color]
  return `| ${names[color]} | ${report.distributions.entrants.find(row=>row.color===color).count} | ${s.wins}/${s.games}（${pct(s.wins,s.games)}） | ${s.nonMirrorWins}/${s.nonMirrorGames}（${pct(s.nonMirrorWins,s.nonMirrorGames)}） | ${s.firstWins}/${s.firstGames}（${pct(s.firstWins,s.firstGames)}） | ${s.wins-s.firstWins}/${s.games-s.firstGames}（${pct(s.wins-s.firstWins,s.games-s.firstGames)}） | ${(s.skills/s.games).toFixed(2)} |`
})
const matrix = colors.map(color => `| ${names[color]} | ${colors.map(other => color === other ? '—' : (()=>{const m=matchup(color,other);return `${m.wins}/${m.games}（${m.rate}）`})()).join(' | ')} |`)
const holdoutRows = holdout.byColor.map(row => `| ${names[row.color]} | ${row.baselineWins}/${row.baselineGames} | ${row.wins}/${row.games} | ${((row.wins/row.games-row.baselineWins/row.baselineGames)*100).toFixed(2)} pp |`)
const sections = colors.map(color => {
  const p = plans[color], s = report.perColor[color]
  return `### ${names[color]}色\n\n${p.strength}\n\n限制：${p.weakness}\n\n目前打法：${p.plan}\n\n下一個檢查點：${p.next}\n\n本次實測：非鏡像${s.nonMirrorWins}/${s.nonMirrorGames}；技能平均${(s.skills/s.games).toFixed(2)}次／局，${s.attacks}次普通攻擊、宣告傷害累計${s.damage}；搜尋資源保留警訊${s.resourceReservationMisses}，合法攻擊略過診斷${s.legalAttackSkipped}。後兩者是策略診斷，不是非法行動數，更多或更少不能單獨代表強弱。`
})
const md = [
  '# BS12 六色 1,028 人賽事與 AI 改善', '',
  `完整賽事：**${report.status}**。11輪瑞士輪${report.swiss.metrics.completedMatches}/5,654場完成，未完成${report.swiss.metrics.stuckMatches}場；16強單淘汰15場。冠軍：**${report.playoff.champion.name}**；亞軍：${report.playoff.runnerUp.name}。`,
  `四強：${report.playoff.top4.map(row=>row.name).join('、')}。`,
  `八強：${report.playoff.top8.map(row=>row.name).join('、')}。`, '',
  '本次環境的主要結論：黑色非鏡像勝率82.59%，對其他五色均達79%以上，並包辦16強。黃色對黑20.52%、紫色19.43%，是本次其他顏色中相對較好的成績，仍未形成有效壓制；不能據此宣稱已有克黑牌組。綠色非鏡像27.53%且兩個Extra缺少主牌登場來源，應優先檢查資源排序與Extra配置。這些結論限定目前六副固定牌表及AI，不等於真人環境的顏色強弱定論。', '',
  '## 方法與邊界', '',
  '使用目前六色固定牌表，不改卡號、張數或Extra；藍／綠各172名，黃／紅／紫／黑各171名，共1,028名。這是同色相同牌表的重複參賽者，不是1,028種構築；人工平衡參賽比例不是外部環境使用率。',
  '開局沿用現有賽事引擎：重抽至手牌有餅乾，選擇手牌第一張餅乾作起始餅乾；未另外加入人工起手選擇或牌表調整。勝率反映此起手流程、固定牌表與目前AI操作的綜合結果。',
  `Lv.5、seed ${report.methodology.seed}、單局最多500步；注入固定時鐘保留原深度／節點預算，四個隔離Node worker。Swiss依勝3分、Buchholz、勝率及預先種子排序；避免重複對戰。16強1v16至8v9，晉級八強依Swiss順位重排，再走固定1v8／4v5／2v7／3v6單淘汰；沒有季軍賽，不宣稱單獨第三與第四。`,
  '第一次診斷前3輪1,542場有34場失敗；第二次修正後診斷4輪2,056場有1場失敗。兩次均中止並保留原種子及錯誤，不計入最終名次或訓練。全部修正後以相同種子從第一輪完整重跑，未挑選有利種子。修正會改變後續積分與配對，因此不能把不同配對的顏色勝率直接當改善量。',
  '第三次診斷完成5輪2,570場、零BS12失敗，但完整回歸發現新傷害保護擋住BS9合法的昏厥Then續接，因此中止並恢復原有特例。最終版先通過跨系列回歸，再從第一輪重跑；第三次資料同樣未混入正式賽果或訓練。',
  '第四次診斷前5輪2,570場有1場失敗：回到手牌的EXTRA餅乾被誤列為補位候選。已修正共用候選及AI一般登場篩選，加入兩種EXTRA來源的強制補位反例，再重新完整執行。所有診斷皆保留，不挑選成功版本中的單場拼接賽果。',
  '第五次診斷前10輪5,140場有1場失敗：Choux與新登場Kouign-Amann的OnPlay並存時，AI拒絕處理規則已指定的after-damage決策。已移除這個額外AI限制；同時全套805檔／17,147項通過，最後守門修正再跑受影響8檔／581項後從第一輪重跑。',
  `本次賽事基準策略版本：\`${report.methodology.strategyVersion}\`；經驗profile：\`${report.methodology.baselineProfile}\`。來源、配方及profile雜湊在JSON報告。Node模擬不代表真人最佳構築或完整線上逐卡驗收。`, '',
  '## 顏色比例', '', '![參賽及各階段顏色比例](../output/bs12-1028/color-distribution.png)', '',
  '| 顏色 | 參賽 | 16強 | 八強 | 四強 |', '|---|---:|---:|---:|---:|',
  ...colors.map(color=>`| ${names[color]} | ${['entrants','top16','top8','top4'].map(key=>{const x=report.distributions[key].find(r=>r.color===color);return `${x.count}（${x.percentage.toFixed(2)}%）`}).join(' | ')} |`), '',
  '## 16強（瑞士輪種子順位）', '', '| 種子 | 參賽者 | 分數 | 勝-敗 | Buchholz |', '|---|---|---:|---:|---:|', ...rows, '',
  '16強為Swiss晉級名單；八強及四強為實際淘汰賽勝者，並非直接截取Swiss前八／前四。完整淘汰配對與逐場勝者見JSON報告。', '',
  '## 各色表現與對戰矩陣', '', '| 顏色 | 參賽數 | 全部勝率 | 非鏡像勝率 | 先攻 | 後攻 | 技能／局 |', '|---|---:|---|---|---|---|---:|', ...summary, '',
  '| 行方對列方 | 藍 | 綠 | 黃 | 紅 | 紫 | 黑 |', '|---|---|---|---|---|---|---|', ...matrix, '',
  '瑞士輪會依戰績分組，並非每個對戰組合的樣本數都相同；不能把小樣本單格當成確定相性。鏡像已另排除以觀察跨顏色表現。', '',
  '## AI 改善及獨立對照', '',
  '已修復六個真實操作缺陷：Licorice沒有Special Play手牌時不選必須放HP的目標；Choux等待目前能力鏈完成時，不阻擋Clotted Cream續接；Venom被FLIP移除後不支付無法替來源補HP的可選代價；Stardust全體逐點傷害先完成戰鬥收尾，再續接技能，保留既有昏厥Then特例；回到手牌的EXTRA餅乾排除於一般登場與補位候選，也不觸發錯誤的強制補位；Choux與新OnPlay並存時依規則descriptor先結算Choux。11個原始失敗種子及BS9／BS11跨系列、待決策、補位與EXTRA共8檔／581項回歸通過。',
  '經驗候選只由最終完成、合法的Swiss公開動作／卡片計數與實際勝負建立，單項先驗限±24；只作用BS12來源，不涵蓋所有BS7／BS11等混入卡。淘汰賽、失敗版本及holdout未混入訓練。這是相關性先驗，不是因果最優動作或完整強化學習。',
  '以下對照兩方皆使用同一份修正後AI程式，只替換經驗profile；「原版」指凍結的舊BS9經驗權重，並非修正前程式。因此這個勝率差只評估經驗候選，不能當成六項程式修正的勝率提升幅度。程式修正的直接證據是原本失敗的11個固定種子現在全部完成。',
  `獨立對照狀態：**${holdout.status}**。21個顏色組合（含鏡像）×4個新種子×交換策略座位及先後手，共${holdout.matches}場；完成${holdout.completed}場、未完成${holdout.matches-holdout.completed}場。候選${holdout.trainedWins}勝、原版${holdout.baselineWins}勝，候選勝率${pct(holdout.trainedWins,holdout.completed)}。各列比較同色策略的勝場，沒有把另一色對手的診斷算在本色。`, '',
  '| 顏色 | 原版勝場／場次 | 候選勝場／場次 | 差（百分點） |', '|---|---:|---:|---:|', ...holdoutRows, '',
  '同種子座位對照彼此相關；描述性勝率及Wilson區間不等於獨立樣本統計顯著。是否採用及完整驗證結果由最終驗證段落記錄，不僅依候選檔案產生就宣布能力提升。', '',
  '## 各色優缺點與目前打法', '',
  '以下打法依本地正式卡文與本次結果推論；牌表保持原清單。換牌／Extra調整均為下一步候選，尚未作匹配換牌benchmark。', '', ...sections, '',
  '## 最終驗證與採用狀態', '',
  verification.summary, '', verification.experienceDecision, '',
  '驗證命令、結束碼與來源雜湊見 `output/bs12-1028/verification-evidence.json`；逐輪／配對／積分／淘汰賽／訓練來源獨立核對見 `result-audit.json`。一般AI Browser已驗證，但沒有將本次Node賽事宣稱為逐卡真人或線上對戰驗收。', '',
  '補位UI專項使用原始失敗狀態交換玩家識別，正向以真實BS7-056從棄牌移到手牌作準備，兩尺寸均以實體ID與正式replace-cookie公開trace核對。早期BS7-046準備式探測另出現不適用技能提示，日誌保留；本次未確認該提示能否在一般介面重現，也未將它當成技能驗收通過。', '',
  '產物：`data/decks/bs12-1028-roster.json`、`data/decks/bs12-1028-report.json`、`output/bs12-1028/`。未修改AGENTS，既有黑色牌組修改與其他產物保留；未commit／push。', '',
].join('\n')
await writeFile('docs/bs12-1028-tournament-2026-10-09.md', md)
await writeFile('output/bs12-1028/matchup-analysis.json', JSON.stringify({ byColor: report.perColor,
  matchups: colors.flatMap(left=>colors.filter(right=>right!==left).map(right=>({left,right,...matchup(left,right)}))) }, null, 2))
console.log('docs/bs12-1028-tournament-2026-10-09.md')
