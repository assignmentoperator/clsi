const fs = require('fs')
const Path = require('path')
const { expect } = require('chai')
const { parseXrefTable } = require('../../../app/lib/pdfjs/parseXrefTable')
const PATH_EXAMPLES = 'test/acceptance/fixtures/examples/'
const PATH_SNAPSHOTS = 'test/unit/js/snapshots/pdfjs/'
const EXAMPLES = fs.readdirSync(PATH_EXAMPLES)

function snapshotPath(example) {
  return Path.join(PATH_SNAPSHOTS, example, 'XrefTable.json')
}

function pdfPath(example) {
  return Path.join(PATH_EXAMPLES, example, 'output.pdf')
}

async function loadContext(example) {
  const size = (await fs.promises.stat(pdfPath(example))).size

  let blob
  try {
    blob = await fs.promises.readFile(snapshotPath(example))
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }
  const snapshot = blob ? JSON.parse(blob) : null
  return {
    size,
    snapshot,
  }
}

async function backFillSnapshot(example, size) {
  const table = await parseXrefTable(pdfPath(example), size, () => {})
  await fs.promises.mkdir(Path.dirname(snapshotPath(example)), {
    recursive: true,
  })
  await fs.promises.writeFile(
    snapshotPath(example),
    JSON.stringify(table, null, 2)
  )
  return table
}

describe('pdfjs', function () {
  describe('when the pdf is an empty file', function () {
    it('should yield no entries', async function () {
      const path = 'does/not/matter.pdf'
      const table = await parseXrefTable(path, 0)
      expect(table).to.deep.equal([])
    })
  })

  describe('when the operation times out', function () {
    it('should bail out', async function () {
      const path = pdfPath(EXAMPLES[0])
      const { size } = await loadContext(EXAMPLES[0])
      const err = new Error()
      let table
      try {
        table = await parseXrefTable(path, size, () => {
          throw err
        })
      } catch (e) {
        expect(e).to.equal(err)
        return
      }
      expect(table).to.not.exist
    })
  })

  for (const example of EXAMPLES) {
    describe(example, function () {
      let size, snapshot
      before('load snapshot', async function () {
        const ctx = await loadContext(example)
        size = ctx.size
        snapshot = ctx.snapshot
      })

      before('back fill new snapshot', async function () {
        if (snapshot === null) {
          console.error('back filling snapshot for', example)
          snapshot = await backFillSnapshot(example, size)
        }
      })

      it('should produce the expected xRef table', async function () {
        const table = await parseXrefTable(pdfPath(example), size, () => {})
        expect(table).to.deep.equal(snapshot)
      })
    })
  }
})
