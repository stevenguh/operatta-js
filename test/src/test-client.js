require('test/helpers/test-helper')
import TextOperation from 'ot/text-operation'
import Client from 'client/client'

test('Test Client', t => {
  const client = new Client(1)
  t.deepEqual(client.revision, 1)
  t.truthy(client.state instanceof Client.Synchronized)

  let sentRevision = null
  let sentOperation = null

  function getSentOperation () {
    const a = sentOperation
    if (!a) {
      throw new Error("sendOperation wasn't called")
    }
    sentOperation = null
    return a
  }

  function getSentRevision () {
    const a = sentRevision
    if (typeof a !== 'number') {
      throw new Error("sendOperation wasn't called")
    }
    sentRevision = null
    return a
  }

  client.sendOperation = (revision, operation) => {
    sentRevision = revision
    sentOperation = operation
  }

  let doc = 'lorem dolor'
  // let appliedOperation = null

  client.applyOperation = operation => {
    doc = operation.apply(doc)
    // appliedOperation = operation
  }

  function applyClient (operation) {
    doc = operation.apply(doc)
    client.applyClient(operation)
  }

  client.applyServer(new TextOperation().retain(6)['delete'](1).insert('D').retain(4))
  t.deepEqual(doc, 'lorem Dolor')
  t.truthy(client.state instanceof Client.Synchronized)
  t.deepEqual(client.revision, 2)

  applyClient(new TextOperation().retain(11).insert(' '))
  t.deepEqual(doc, 'lorem Dolor ')
  t.truthy(client.state instanceof Client.AwaitingConfirm)
  t.deepEqual(getSentRevision(), 2)
  t.truthy(client.state.outstanding.equals(new TextOperation().retain(11).insert(' ')))
  t.truthy(getSentOperation().equals(new TextOperation().retain(11).insert(' ')))

  client.applyServer(new TextOperation().retain(5).insert(' ').retain(6))
  t.deepEqual(doc, 'lorem  Dolor ')
  t.deepEqual(client.revision, 3)
  t.truthy(client.state instanceof Client.AwaitingConfirm)
  t.truthy(client.state.outstanding.equals(new TextOperation().retain(12).insert(' ')))

  applyClient(new TextOperation().retain(13).insert('S'))
  t.truthy(client.state instanceof Client.AwaitingWithBuffer)
  applyClient(new TextOperation().retain(14).insert('i'))
  applyClient(new TextOperation().retain(15).insert('t'))
  t.truthy(!sentRevision && !sentOperation)
  t.deepEqual(doc, 'lorem  Dolor Sit')
  t.truthy(client.state.outstanding.equals(new TextOperation().retain(12).insert(' ')))
  t.truthy(client.state.buffer.equals(new TextOperation().retain(13).insert('Sit')))

  client.applyServer(new TextOperation().retain(6).insert('Ipsum').retain(6))
  t.deepEqual(client.revision, 4)
  t.deepEqual(doc, 'lorem Ipsum Dolor Sit')
  t.truthy(client.state instanceof Client.AwaitingWithBuffer)
  t.truthy(client.state.outstanding.equals(new TextOperation().retain(17).insert(' ')))
  t.truthy(client.state.buffer.equals(new TextOperation().retain(18).insert('Sit')))

  client.serverAck()
  t.deepEqual(getSentRevision(), 5)
  t.truthy(getSentOperation().equals(new TextOperation().retain(18).insert('Sit')))
  t.deepEqual(client.revision, 5)
  t.truthy(client.state instanceof Client.AwaitingConfirm)
  t.truthy(client.state.outstanding.equals(new TextOperation().retain(18).insert('Sit')))

  client.serverAck()
  t.deepEqual(client.revision, 6)
  t.truthy(typeof sentRevision !== 'number')
  t.truthy(client.state instanceof Client.Synchronized)
  t.deepEqual(doc, 'lorem Ipsum Dolor Sit')

  // Test AwaitingConfirm and AwaitingWithBuffer resend operation.
  client.applyClient(new TextOperation().retain(21).insert('a'))
  t.truthy(client.state instanceof Client.AwaitingConfirm)
  t.truthy(!!client.state.resend)
  client.applyClient(new TextOperation().retain(22).insert('m'))
  t.truthy(client.state instanceof Client.AwaitingWithBuffer)
  t.truthy(!!client.state.resend)

  client.state.resend(client)
  t.truthy(sentOperation.equals(new TextOperation().retain(21).insert('a')))
  client.serverAck()
  t.truthy(sentOperation.equals(new TextOperation().retain(22).insert('m')))
})