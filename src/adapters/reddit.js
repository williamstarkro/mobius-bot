const Snoowrap = require('snoowrap')
const Adapter = require('./abstract')
const utils = require('../utils')

// *** +++ Reddit API +
function getR() {
  const r = new Snoowrap({
    userAgent: process.env.REDDIT_USER,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS,
  })

  r.config({
    continueAfterRatelimitError: true,
    warnings: false,
    maxRetryAttempts: 10
  })

  return r
}


/**
 * Reddit sometimes get's out of reach and throws 503.
 *
 * This is not very problematic for us, as we can collect comments and messages later
 * on and only very, very rarely tips will fail (leaving the balance untouched).
 */
async function callReddit(func, data, client) {
  client = client || getR()

  try {
    return await client[func](data)
  } catch (exc) {
    utils.log(`${exc.name} - Failed to execute ${func} with data:`, data)
  }
}

/**
 * Adds the bot footer to the message.
 */
function formatMessage(txt) {
  return txt +
    '\n\n\n\n' +
    '[Deposit]REDDIT DEPOSIT LINK | ' +
    `[Withdraw](https://np.reddit.com/message/compose/?to=${process.env.REDDIT_USER}&subject=Withdraw&message=Amount%20XLM%0Aaddress%20here) | ` +
    `[Balance](https://np.reddit.com/message/compose/?to=${process.env.REDDIT_USER}&subject=Balance&message=Tell%20me%20my%20XLM%20Balance!) | ` +
    '[Help]REDDIT HELP LINK | ' +
    '[Donate]REDDIT DONATION LINK| ' +
    '[About Stellar](https://mobius.network/)'
}

class Reddit extends Adapter {

  async onDeposit (sourceAccount, amount) {
    await callReddit('composeMessage', {
      to: sourceAccount.uniqueId,
      subject: 'MOBI Deposit',
      text: formatMessage(`**${amount} MOBI** have been sucessfully deposited to your account.`)
    })
  }

  async onTipWithInsufficientBalance (tip, amount) {
    callReddit('composeMessage', {
      to: tip.sourceId,
      subject: 'Tipping failed',
      text: formatMessage(`I can not tip for you. Your balance is insufficient. Deposit and try again.`)
    })
  }

  async onTipTransferFailed(tip, amount) {
    callReddit('composeMessage', {
      to: tip.sourceId,
      subject: 'Tipping failed',
      text: formatMessage(`I could not tip for you, because of an unknown error. Please try again.`)
    })
  }

  async onTipReferenceError (tip, amount) {
    callReddit('composeMessage', {
      to: tip.sourceId,
      subject: 'Tipping failed',
      text: formatMessage(`You tried to tip yourself. That does not work.`)
    })
  }

  async onTip (tip, amount) {
    await callReddit('reply', formatMessage(`You tipped **${amount} MOBI** to *${tip.targetId}*.`), tip.original)
    callReddit('composeMessage', {
      to: tip.sourceId,
      subject: 'Tipped!',
      text: formatMessage(`You tipped **${amount} MOBI** to *${tip.targetId}*.`)
    })
    callReddit('composeMessage', {
      to: tip.targetId,
      subject: 'Tipped!',
      text: formatMessage(`*${tip.sourceId}* tipped **${amount} MOBI** to you. Have fun and enjoy the mobius experience.`)
    })
  }

  async onWithdrawalReferenceError (uniqueId, address, amount, hash) {
    callReddit('composeMessage', {
      to: uniqueId,
      subject: 'MOBI Withdrawal failed',
      text: formatMessage(`You tried to withdraw to the bot address. Please try again.`)
    })
  }

  async onWithdrawalDestinationAccountDoesNotExist (uniqueId, address, amount, hash) {
    await callReddit('composeMessage', {
      to: uniqueId,
      subject: 'MOBI Withdrawal failed',
      text: formatMessage(`I could not withdraw. The requested public address does not exist.`)
    })
  }

  async onWithdrawalFailedWithInsufficientBalance (uniqueId, address, amount, hash) {
    await callReddit('composeMessage', {
      to: uniqueId,
      subject: 'MOBI Withdrawal failed',
      text: formatMessage(`I could not withdraw. You requested more than your current balance. Please adjust and try again.`)
    })
  }

  async onWithdrawalInvalidAddress (uniqueId, address ,amount, hash) {
    await callReddit('composeMessage', {
      to: uniqueId,
      subject: 'MOBI Withdrawal failed',
      text: formatMessage(`I could not withdraw. The given address is not a valid mobius address.`)
    })
  }

  async onWithdrawalSubmissionFailed (uniqueId, address, amount, hash) {
    this.onWithdrawalReferenceError(uniqueId, address, amount, hash)
  }

  async onWithdrawal (uniqueId, address, amount, hash) {
    await callReddit('composeMessage', {
      to: uniqueId,
      subject: 'MOBI Withdrawal',
      text: formatMessage(`**${amount} MOBI** are on their way to ${address}.`)
    })
  }

  constructor (config) {
    super(config)

    this.name = 'reddit'

    this.subreddits = process.env.REDDIT_SUBREDDITS.split(',')

    this.pollMessages()
    for (let sub of this.subreddits) {
      this.pollComments(sub)
    }
  }

  /**
   * Polls comments in the registered subreddits every 2 secs.
   */
  async pollComments (subreddit, lastBatch) {
    lastBatch = lastBatch || []

    const comments = await callReddit('getNewComments', subreddit)

    if (comments === undefined) {
      return this.pollComments(subreddit, lastBatch)
    }

    comments.filter((comment) => {
      return lastBatch.every(batch => batch.id != comment.id)
    }).forEach(async (comment) => {
      const tipAmount = this.extractTipAmount(comment.body)
      if (tipAmount) {
        const targetComment = await callReddit('getComment', comment.parent_id)
        if (targetComment) {
          this.receivePotentialTip({
            adapter: this.name,
            sourceId: comment.author.name,
            targetId: await targetComment.author.name,
            amount: tipAmount,
            original: comment,
            hash: comment.id
          })
        }
      }
    })

    lastBatch = comments

    await utils.sleep((60 / (60 / this.subreddits.length)) * 1000)
    this.pollComments(subreddit, lastBatch)
  }

  /**
   * Polls unread messages to the bot and answers them.
   */
  async pollMessages () {
    const messages = await callReddit('getUnreadMessages') || []
    let processedMessages = []

    await messages
      .filter(m => ['Withdraw', 'Balance', 'memoId'].indexOf(m.subject) > -1 && !m.was_comment)
      .forEach(async (m) => {
        // Check the balance of the user
        if (m.subject === 'Balance') {
          const balance = await this.requestBalance(this.name, m.author.name)
          await callReddit('composeMessage', {
            to: m.author.name,
            subject: 'MOBI Balance',
            text: formatMessage(`Your current balance is **${balance} MOBI**.`)
          })
          await callReddit('markMessagesAsRead', [m])
        }

        if (m.subject === 'Withdraw') {
          const extract = this.extractWithdrawal(m.body_html)

          if (!extract) {
            utils.log(`MOBI withdrawal failed - unparsable message from ${m.author.name}.`)
            await callReddit('composeMessage', {
              to: m.author.name,
              subject: 'MOBI Withdrawal failed',
              text: formatMessage(`I could not withdraw. Please make sure that the first line of the body is withdrawal amount and the second line your public key.`)
            })
          } else {
            await callReddit('markMessagesAsRead', [m])
            this.receiveWithdrawalRequest({
              adapter: this.name,
              uniqueId: m.author.name,
              amount: extract.amount,
              address: extract.address,
              hash: m.id
            })
          }
        }

        if (m.subject === 'memoId') {
          const options = await this.setAccountOptions(this.name, m.author.name, {refreshMemoId: true})
          const newMemoId = options.refreshMemoId
          await callReddit('composeMessage', {
            to: m.author.name,
            subject: 'memoId refreshed',
            text: formatMessage(`Your new memoId is **${newMemoId}**. Please use it for subsequent deposits.`)
          })
        }

        await callReddit('markMessagesAsRead', [m])
      })

    await utils.sleep(2000)
    this.pollMessages()
  }

  /**
   * All supported tipping formats ...
   */
  extractTipAmount (tipText) {
    const matches =  tipText.match(/\+\+\+[\s{1}]?[\d\.]*[\s{1}]?MOBI/i)
    return matches ? matches[0].replace('+++', '').replace(/mobi/i, '').replace(/\s/g, '') : undefined
  }

  /**
   * Extract withdrawal information from the message.
   */
  extractWithdrawal (body) {
    const parts = body.slice(body.indexOf('<p>') + 3, body.indexOf('</p>')).split('\n')

    if (parts.length === 2) {
      const amount = parts[0].match(/([\d\.]*)/)[0]
      const address = parts[1]

      if (amount && address) {
        return {
          amount, address
        }
      }
      return undefined
    }
  }
}

module.exports = Reddit