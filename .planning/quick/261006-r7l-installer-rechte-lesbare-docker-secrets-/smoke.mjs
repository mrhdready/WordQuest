import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../../..')
const mode = path => statSync(path).mode & 0o777

function installer(checkSecrets = false) {
  const fixture = mkdtempSync(resolve(tmpdir(), 'wordquest-installer-'))
  try {
    copyFileSync(resolve(root, 'setup.sh'), resolve(fixture, 'setup.sh'))
    chmodSync(resolve(fixture, 'setup.sh'), mode(resolve(root, 'setup.sh')))
    mkdirSync(resolve(fixture, 'bin'))
    writeFileSync(resolve(fixture, 'bin/docker'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    writeFileSync(resolve(fixture, '.env'), 'WQ_HOST=wordquest.test\n')
    const options = { cwd: fixture, env: { ...process.env, PATH: `${fixture}/bin:${process.env.PATH}` }, timeout: 10_000, encoding: 'utf8' }
    const direct = spawnSync(resolve(fixture, 'setup.sh'), [], options)
    // Bei fehlendem Ausfuehrungsbit die Neuanlage trotzdem separat pruefen.
    const first = direct.status === 0 ? direct : spawnSync('bash', ['./setup.sh'], options)
    assert.equal(first.status, 0, first.stderr)
    assert.equal(mode(resolve(fixture, 'secrets')), 0o700)
    const files = ['db_password', 'jwt_key'].map(name => resolve(fixture, `secrets/${name}.txt`))
    const contents = files.map(file => readFileSync(file))
    const initialModes = files.map(mode)
    if (checkSecrets) {
      const container = spawnSync('docker', [
        'run', '--rm', '--entrypoint', 'sh',
        ...files.flatMap(file => ['--mount', `type=bind,source=${file},target=/run/secrets/${file.split('/').at(-1)},readonly`]),
        'wordquest-quickfix-api:local', '-c',
        'test "$(id -u)" != 0 && test -r /run/secrets/db_password.txt && test -r /run/secrets/jwt_key.txt && test ! -w /run/secrets/db_password.txt && test ! -w /run/secrets/jwt_key.txt',
      ], { encoding: 'utf8', timeout: 30_000 })
      console.log(JSON.stringify({ secrets: { nonRootReadOnlyReadable: container.status === 0, status: container.status } }))
      assert.equal(container.status, 0, container.stderr || 'Non-Root-Container kann Secrets nicht lesen')
      return
    }
    for (const file of files) chmodSync(file, 0o600)
    const second = spawnSync('bash', ['./setup.sh'], options)
    assert.equal(second.status, 0, second.stderr)
    for (const [i, file] of files.entries()) assert.deepEqual(readFileSync(file), contents[i])
    const checks = {
      executable: direct.status === 0,
      newSecretsReadable: initialModes.every(value => value === 0o644),
      existingSecretsReadable: files.every(file => mode(file) === 0o644),
      privateDirectory: mode(resolve(fixture, 'secrets')) === 0o700,
      contentsPreserved: true,
    }
    console.log(JSON.stringify({ installer: checks }))
    assert.ok(Object.values(checks).every(Boolean), 'Installer-Regression fehlgeschlagen')
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}

if (process.argv[2] === '--installer') installer()
else if (process.argv[2] === '--secrets') installer(true)
else throw new Error('Aufruf: node smoke.mjs --installer|--secrets')
