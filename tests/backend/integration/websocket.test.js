// tests/backend/integration/websocket.test.js
require('../setup');
const Client = require('socket.io-client');
const server = require('../../../backend/server');
const Contract = require('../../../backend/models/Contract');

describe('WebSocket Integration Tests', () => {
  let io;
  let clientSocket;
  let serverSocket;
  let authToken;
  let testUser;

  beforeAll((done) => {
    server.listen(async () => {
      const port = server.address().port;
      
      testUser = await createTestUser();
      authToken = generateAuthToken(testUser);
      
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token: authToken }
      });
      
      server.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    server.close();
    clientSocket.close();
  });

  describe('Authentication', () => {
    it('should authenticate with valid token', (done) => {
      const testSocket = new Client(`http://localhost:${server.address().port}`, {
        auth: { token: authToken }
      });

      testSocket.on('connect', () => {
        expect(testSocket.connected).toBe(true);
        testSocket.close();
        done();
      });
    });

    it('should reject invalid token', (done) => {
      const testSocket = new Client(`http://localhost:${server.address().port}`, {
        auth: { token: 'invalid-token' }
      });

      testSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        done();
      });
    });
  });

  describe('Contract Collaboration', () => {
    let testContract;

    beforeEach(async () => {
      testContract = await Contract.create({
        title: 'WebSocket Test Contract',
        clientName: 'WS Client',
        createdBy: testUser._id
      });
    });

    it('should join contract room', (done) => {
      clientSocket.emit('join:contract', { contractId: testContract._id });
      
      clientSocket.on('joined:contract', (data) => {
        expect(data.contractId).toBe(testContract._id.toString());
        expect(data.users).toContain(testUser._id.toString());
        done();
      });
    });

    it('should broadcast contract updates', (done) => {
      const secondClient = new Client(`http://localhost:${server.address().port}`, {
        auth: { token: authToken }
      });

      secondClient.on('connect', () => {
        // Both clients join the same contract
        clientSocket.emit('join:contract', { contractId: testContract._id });
        secondClient.emit('join:contract', { contractId: testContract._id });

        // First client sends update
        clientSocket.emit('contract:update', {
          contractId: testContract._id,
          changes: { title: 'Updated via WebSocket' }
        });

        // Second client receives update
        secondClient.on('contract:updated', (data) => {
          expect(data.contractId).toBe(testContract._id.toString());
          expect(data.changes.title).toBe('Updated via WebSocket');
          expect(data.updatedBy).toBe(testUser._id.toString());
          secondClient.close();
          done();
        });
      });
    });

    it('should handle concurrent editing', (done) => {
      const client1 = new Client(`http://localhost:${server.address().port}`, {
        auth: { token: authToken }
      });
      
      const client2 = new Client(`http://localhost:${server.address().port}`, {
        auth: { token: authToken }
      });

      let updates = [];

      Promise.all([
        new Promise(resolve => client1.on('connect', resolve)),
        new Promise(resolve => client2.on('connect', resolve))
      ]).then(() => {
        // Both join contract
        client1.emit('join:contract', { contractId: testContract._id });
        client2.emit('join:contract', { contractId: testContract._id });

        // Listen for lock events
        client2.on('field:locked', (data) => {
          expect(data.field).toBe('content');
          expect(data.lockedBy).toBe(testUser._id.toString());
        });

        // Client 1 locks field
        client1.emit('field:lock', {
          contractId: testContract._id,
          field: 'content'
        });

        // Client 2 tries to edit locked field
        client2.emit('field:edit', {
          contractId: testContract._id,
          field: 'content',
          value: 'Should fail'
        });

        client2.on('field:error', (data) => {
          expect(data.error).toContain('locked');
          client1.close();
          client2.close();
          done();
        });
      });
    });
  });

  describe('Real-time Comments', () => {
    let testContract;

    beforeEach(async () => {
      testContract = await Contract.create({
        title: 'Comment Test Contract',
        clientName: 'Comment Client',
        createdBy: testUser._id
      });
    });

    it('should broadcast new comments', (done) => {
      const listener = new Client(`http://localhost:${server.address().port}`, {
        auth: { token: authToken }
      });

      listener.on('connect', () => {
        // Join contract room
        clientSocket.emit('join:contract', { contractId: testContract._id });
        listener.emit('join:contract', { contractId: testContract._id });

        // Listen for comments
        listener.on('comment:added', (data) => {
          expect(data.comment.text).toBe('Real-time comment');
          expect(data.comment.author).toBe(testUser._id.toString());
          listener.close();
          done();
        });

        // Send comment
        clientSocket.emit('comment:add', {
          contractId: testContract._id,
          text: 'Real-time comment'
        });
      });
    });
  });

  describe('Presence Tracking', () => {
    it('should track user presence', (done) => {
      const presenceClient = new Client(`http://localhost:${server.address().port}`, {
        auth: { token: authToken }
      });

      presenceClient.on('connect', () => {
        presenceClient.emit('join:contract', { contractId: 'test-contract-id' });

        presenceClient.on('presence:update', (data) => {
          expect(data.users).toBeInstanceOf(Array);
          expect(data.users).toContainEqual(
            expect.objectContaining({
              userId: testUser._id.toString(),
              status: 'active'
            })
          );
          presenceClient.close();
          done();
        });
      });
    });

    it('should handle disconnect', (done) => {
      const tempClient = new Client(`http://localhost:${server.address().port}`, {
        auth: { token: authToken }
      });

      tempClient.on('connect', () => {
        tempClient.emit('join:contract', { contractId: 'disconnect-test' });

        // Listen on main client for disconnect
        clientSocket.on('user:left', (data) => {
          expect(data.userId).toBe(testUser._id.toString());
          done();
        });

        // Disconnect temp client
        setTimeout(() => tempClient.close(), 100);
      });
    });
  });
});