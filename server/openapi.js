// API documentation in the OpenAPI format. It is shown as an interactive page at /api/docs.
const json = (description) => ({ description, content: { 'application/json': {} } });
const body = (properties, required = Object.keys(properties)) => ({
  required: true,
  content: { 'application/json': { schema: { type: 'object', properties, required } } },
});
const str = { type: 'string' };
const ok = { 200: json('Success') };
const created = { 201: json('Created'), 400: json('Invalid input') };
const idParam = (name = 'id') => ({ name, in: 'path', required: true, schema: str });

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Student Document Submission Portal API',
    version: '2.0.0',
    description: 'Log in with POST /api/auth/login first. The login cookie is then sent with every request.',
  },
  tags: [
    { name: 'Account' }, { name: 'Student documents' }, { name: 'Mentor' },
    { name: 'Admin' }, { name: 'Notifications' }, { name: 'System' },
  ],
  paths: {
    '/api/auth/register': { post: { tags: ['Account'], summary: 'Create a student account', requestBody: body({ systemId: str, name: str, password: str, batch: str }, ['systemId', 'name', 'password']), responses: { ...created, 409: json('System ID already registered') } } },
    '/api/auth/login': { post: { tags: ['Account'], summary: 'Log in and receive the login cookie', requestBody: body({ systemId: str, password: str }), responses: { ...ok, 401: json('Wrong ID or password'), 429: json('Too many attempts') } } },
    '/api/auth/logout': { post: { tags: ['Account'], summary: 'Log out', responses: ok } },
    '/api/auth/me': {
      get: { tags: ['Account'], summary: 'Current user, batch, mentor and deadline', responses: { ...ok, 401: json('Not logged in') } },
      patch: { tags: ['Account'], summary: 'Change own name', requestBody: body({ name: str }), responses: ok },
    },
    '/api/auth/password': { post: { tags: ['Account'], summary: 'Change own password', requestBody: body({ currentPassword: str, newPassword: str }), responses: ok } },
    '/api/batches': { get: { tags: ['Account'], summary: 'List batches for the registration form', responses: ok } },
    '/api/documents': { get: { tags: ['Student documents'], summary: 'List own documents and deadline (student)', responses: ok } },
    '/api/documents/{type}': { post: { tags: ['Student documents'], summary: 'Upload a new version (report, plagiarism or certificate)', parameters: [idParam('type')], requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { ...created, 403: json('Deadline passed'), 409: json('Already approved'), 413: json('Larger than 5 MB') } } },
    '/api/documents/{id}': { get: { tags: ['Student documents'], summary: 'Document details, versions and comments', parameters: [idParam()], responses: { ...ok, 403: json('Not allowed') } } },
    '/api/documents/{id}/file': { get: { tags: ['Student documents'], summary: 'Download or preview a version', parameters: [idParam(), { name: 'version', in: 'query', schema: { type: 'integer' } }, { name: 'view', in: 'query', schema: { type: 'string', enum: ['1'] } }], responses: { 200: { description: 'The PDF file', content: { 'application/pdf': {} } } } } },
    '/api/documents/{id}/comments': { post: { tags: ['Student documents'], summary: 'Send a message about a document', parameters: [idParam()], requestBody: body({ text: str }), responses: created } },
    '/api/mentor/students': { get: { tags: ['Mentor'], summary: 'Assigned students (all students for an admin)', responses: ok } },
    '/api/mentor/students/{id}': { get: { tags: ['Mentor'], summary: 'One student with documents and comments', parameters: [idParam()], responses: ok } },
    '/api/mentor/documents/{id}': { patch: { tags: ['Mentor'], summary: 'Approve or reject a document', parameters: [idParam()], requestBody: body({ status: { type: 'string', enum: ['Approved', 'Rejected'] }, comment: str, similarity: { type: 'number' } }, ['status']), responses: { ...ok, 400: json('Comment or similarity missing') } } },
    '/api/admin/stats': { get: { tags: ['Admin'], summary: 'Analytics for the charts', responses: ok } },
    '/api/admin/export.csv': { get: { tags: ['Admin'], summary: 'Download submission status as CSV', responses: { 200: { description: 'CSV file', content: { 'text/csv': {} } } } } },
    '/api/admin/users': {
      get: { tags: ['Admin'], summary: 'List all users', responses: ok },
      post: { tags: ['Admin'], summary: 'Create a user (for example a mentor)', requestBody: body({ systemId: str, name: str, password: str, role: { type: 'string', enum: ['student', 'mentor', 'admin'] } }), responses: created },
    },
    '/api/admin/users/{id}': { patch: { tags: ['Admin'], summary: 'Change role, batch, mentor, extension or active status', parameters: [idParam()], requestBody: body({ role: str, batch: str, mentor: str, extendedDeadline: str, active: { type: 'boolean' } }, []), responses: ok } },
    '/api/admin/batches': { post: { tags: ['Admin'], summary: 'Create a batch with a deadline', requestBody: body({ name: str, deadline: { type: 'string', format: 'date-time' } }), responses: created } },
    '/api/admin/batches/{id}': {
      patch: { tags: ['Admin'], summary: 'Rename a batch or change its deadline', parameters: [idParam()], requestBody: body({ name: str, deadline: str }, []), responses: ok },
      delete: { tags: ['Admin'], summary: 'Delete an empty batch', parameters: [idParam()], responses: { ...ok, 409: json('Batch still has students') } },
    },
    '/api/admin/audit': { get: { tags: ['Admin'], summary: 'Latest 300 audit log entries', responses: ok } },
    '/api/notifications': { get: { tags: ['Notifications'], summary: 'Latest notifications and unread count', responses: ok } },
    '/api/notifications/{id}/read': { post: { tags: ['Notifications'], summary: 'Mark one as read', parameters: [idParam()], responses: ok } },
    '/api/notifications/read-all': { post: { tags: ['Notifications'], summary: 'Mark all as read', responses: ok } },
    '/api/reminders/run': { post: { tags: ['System'], summary: 'Send deadline reminders (needs the CRON_SECRET key)', security: [{ bearer: [] }], responses: { ...ok, 401: json('Invalid key') } } },
    '/api/health': { get: { tags: ['System'], summary: 'Health check used by Render and monitoring', responses: { ...ok, 503: json('Database not connected') } } },
  },
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
};
