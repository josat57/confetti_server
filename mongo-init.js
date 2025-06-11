db = db.getSiblingDB('admin');
db.createUser({
  user: 'confetti',
  pwd: 'Ginger_123',
  roles: [
    { role: 'userAdminAnyDatabase', db: 'admin' },
    { role: 'readWriteAnyDatabase', db: 'admin' }
  ]
});

// Create the application database
db = db.getSiblingDB('confetti');
db.createCollection('users');
db.createCollection('events'); 