const assert = require('assert')
const Twitter = require('../src/adapters/twitter')

class TestableTwitter extends Twitter {
  connect() {}
  getMentions () {}
}

describe('twitterAdapter', async () => {

  let twitterAdapter;

  beforeEach(async () => {
      const config = await require('./setup')()
      twitterAdapter = new TestableTwitter(config)
  })

  describe('extractTipAmount', () => {
    it ('should extract valid payments', () => {
      assert.equal('1', twitterAdapter.extractTipAmount('foo +++1 MOBI bar'))
      assert.equal('1.12', twitterAdapter.extractTipAmount('foo +++1.12 MOBI bar'))
      assert.equal('100', twitterAdapter.extractTipAmount('foo +++100 MOBI!'))
      assert.equal('10', twitterAdapter.extractTipAmount('foo +++10MOBI bar'))
      assert.equal('10', twitterAdapter.extractTipAmount('foo +++ 10MOBI bar'))
      assert.equal('10.123', twitterAdapter.extractTipAmount('foo +++ 10.123 MOBI bar'))
      assert.equal('1.12', twitterAdapter.extractTipAmount('foo +++ 1.12MOBI bar'))
    })

    it ('should return undefined if no payment is included', () => {
      assert.equal(undefined, twitterAdapter.extractTipAmount('foo 1 bar'))
      assert.equal(undefined, twitterAdapter.extractTipAmount('foo 1.12 bar'))
      assert.equal(undefined, twitterAdapter.extractTipAmount('hello world'))
    })
  })

  describe('extractWithdrawal', () => {
    it ('should extract valid withdrawals', () => {
      const sample = 'withdraw 12.543 MOBI to GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z'
      const data = twitterAdapter.extractWithdrawal(sample)
      assert.equal('12.543', data.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data.address)

      const sample2 = 'withdraw 1 MOBI to GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z'
      const data2 = twitterAdapter.extractWithdrawal(sample2)
      assert.equal('1', data2.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data2.address)

      const sample3 = 'WITHDRAW 1 MOBI to GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z'
      const data3 = twitterAdapter.extractWithdrawal(sample3)
      assert.equal('1', data3.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data3.address)
    })

    it ('should reject invalid withdrawals', () => {
      // Invalid amount
      const sample = 'withdraw Test MOBI to GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z'
      assert.equal(undefined, twitterAdapter.extractWithdrawal(sample))
    })
  })
})
