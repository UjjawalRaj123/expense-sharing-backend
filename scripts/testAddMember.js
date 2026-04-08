const API = process.env.API_BASE || 'http://localhost:5000/api';

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error('Request failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function run() {
  try {
    let login;
    try {
      login = await req('/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testa@example.com', password: 'password' }),
      });
    } catch (err) {
      // If login failed, try registering the user and login again
      if (err.status === 401) {
        console.log('User not found, registering testa@example.com');
        await req('/users/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tester A', email: 'testa@example.com', password: 'password' }),
        });
        login = await req('/users/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'testa@example.com', password: 'password' }),
        });
      } else throw err;
    }
    const token = login.token;
    console.log('Token obtained length:', token?.length || 0);

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    let groupsRes = await req('/groups', { headers });
    let groups = groupsRes.groups;
    let group;
    if (!groups || groups.length === 0) {
      console.log('No groups found — creating a test group');
      const createRes = await req('/groups', {
        method: 'POST', headers, body: JSON.stringify({ name: 'Test Group', description: 'Auto-created by test script', memberIds: [] }),
      });
      group = createRes.group;
    } else {
      group = groups[0];
    }
    console.log('Using group:', group._id, group.name);

    const usersRes = await req('/users', { headers });
    const users = usersRes.users;

    const memberIds = (group.members || []).map(m => (m._id ? m._id : m));
    const toAdd = users.find(u => !memberIds.includes(u._id));
    if (!toAdd) { console.log('No available user to add'); return; }

    console.log('Attempting add:', toAdd.email, toAdd._id);
    const addRes = await req(`/groups/${group._id}/members`, {
      method: 'POST', headers, body: JSON.stringify({ userId: toAdd._id }),
    });
    console.log('Add response message:', addRes.message);
    console.log('Members now:', addRes.group.members.length);
  } catch (err) {
    console.error('Error:', err.status || err.message);
    if (err.body) console.error('Body:', JSON.stringify(err.body));
    process.exit(1);
  }
}

run();
