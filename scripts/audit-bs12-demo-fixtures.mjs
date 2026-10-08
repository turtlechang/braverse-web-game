import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import ts from 'typescript'

const path = 'src/game/demo.ts'
const source = readFileSync(path, 'utf8')
const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
const syntheticHelpers = new Set(['testSupportCard', 'testCookieCard', 'cardCheckFillerCookie'])
const rows = []
for (const statement of tree.statements) {
  if (!ts.isVariableStatement(statement)) continue
  for (const declaration of statement.declarationList.declarations) {
    const name = declaration.name.getText(tree)
    if (!name.startsWith('createBs12') || !declaration.initializer) continue
    const calls = []
    const inspect = node => {
      if (ts.isCallExpression(node) && syntheticHelpers.has(node.expression.getText(tree))) {
        calls.push({ helper: node.expression.getText(tree), line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 })
      }
      ts.forEachChild(node, inspect)
    }
    inspect(declaration.initializer)
    rows.push({ name, line: tree.getLineAndCharacterOfPosition(declaration.getStart(tree)).line + 1, syntheticCalls: calls,
      status: calls.length ? 'requires-physical-fixture-repair' : 'requires-runtime-identity-audit' })
  }
}
mkdirSync('test-results', { recursive: true })
const report = { recordedAt: new Date().toISOString(), source: path,
  scope: 'Static triage of BS12 factories. No synthetic calls does not prove physical identity, copy limits, legal cost, target or Browser behavior.',
  factories: rows.length, factoriesWithSyntheticCalls: rows.filter(row => row.syntheticCalls.length).length,
  syntheticCallSites: rows.reduce((sum, row) => sum + row.syntheticCalls.length, 0), rows }
writeFileSync(process.env.BS12_FIXTURE_AUDIT_OUTPUT ?? 'test-results/bs12-physical-fixture-triage.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ factories: report.factories, factoriesWithSyntheticCalls: report.factoriesWithSyntheticCalls, syntheticCallSites: report.syntheticCallSites }))
