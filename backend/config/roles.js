const permissions = {
  manage_users: 'manage_users',
  manage_teams: 'manage_teams',
  create_tasks: 'create_tasks',
  delete_tasks: 'delete_tasks',
  view_analytics: 'view_analytics',
  schedule_meetings: 'schedule_meetings',
  delete_meetings: 'delete_meetings',
};

const rolePermissions = {
  CEO: [
    permissions.manage_users,
    permissions.manage_teams,
    permissions.create_tasks,
    permissions.delete_tasks,
    permissions.view_analytics,
    permissions.schedule_meetings,
    permissions.delete_meetings,
  ],
  CTO: [
    permissions.manage_users,
    permissions.manage_teams,
    permissions.create_tasks,
    permissions.delete_tasks,
    permissions.view_analytics,
    permissions.schedule_meetings,
    permissions.delete_meetings,
  ],
  Manager: [
    permissions.create_tasks,
    permissions.view_analytics,
    permissions.schedule_meetings,
  ],
  Member: [
    // Members can operate normally on tasks assigned to them, 
    // but these generic global permissions are restricted.
  ]
};

const hasPermission = (role, permission) => {
  return rolePermissions[role]?.includes(permission) || false;
};

module.exports = {
  permissions,
  rolePermissions,
  hasPermission
};
