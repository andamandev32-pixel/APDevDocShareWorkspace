const mysql = require('mysql2/promise');

module.exports = async (req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // We look for secrets in env vars first, then fallback to defaults (for testing/safety)
        const host = process.env.DB_HOST || '141.98.17.115';
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASSWORD || 'Andaman888';
        const database = process.env.DB_NAME || 'doc_workspace';

        // Connect to MariaDB
        const connection = await mysql.createConnection({
            host: host,
            user: user,
            password: password,
            database: database,
            timezone: 'Z',
            connectTimeout: 10000 // 10 seconds
        });

        // Helper mapper
        function mapRowToProject(row) {
            return {
                id: row.id,
                title: row.title,
                desc: row.description,
                pin: row.pin,
                type: row.project_type,
                html: row.html_content,
                css: row.css_content,
                js: row.js_content,
                jsx: row.jsx_content,
                favorite: Boolean(row.favorite),
                createdAt: row.created_at
            };
        }

        switch (req.method) {
            case 'GET': {
                const [rows] = await connection.execute('SELECT * FROM share_projects ORDER BY favorite DESC, created_at DESC');
                const projects = rows.map(mapRowToProject);
                res.status(200).json(projects);
                break;
            }
            case 'POST': {
                const data = req.body;
                if (!data || !data.id || !data.title || !data.type) {
                    res.status(400).json({ error: 'Missing required fields' });
                    break;
                }
                const query = `
                    INSERT INTO share_projects 
                      (id, title, description, pin, project_type, html_content, css_content, js_content, jsx_content, favorite, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const rawDate = data.createdAt ? new Date(data.createdAt) : new Date();
                const formattedDate = rawDate.toISOString().slice(0, 19).replace('T', ' ');

                const values = [
                    data.id,
                    data.title,
                    data.desc || '',
                    data.pin || null,
                    data.type,
                    data.html || null,
                    data.css || null,
                    data.js || null,
                    data.jsx || null,
                    data.favorite ? 1 : 0,
                    formattedDate
                ];
                await connection.execute(query, values);
                res.status(201).json({ message: 'Project created' });
                break;
            }
            case 'PUT': {
                const data = req.body;
                if (!data || !data.id) {
                    res.status(400).json({ error: 'Project ID is required' });
                    break;
                }
                const query = `
                    UPDATE share_projects SET 
                        title = ?, description = ?, pin = ?, project_type = ?, 
                        html_content = ?, css_content = ?, js_content = ?, 
                        jsx_content = ?, favorite = ?
                    WHERE id = ?
                `;
                const values = [
                    data.title,
                    data.desc || '',
                    (data.pin === undefined || data.pin === '') ? null : data.pin,
                    data.type,
                    data.html || null,
                    data.css || null,
                    data.js || null,
                    data.jsx || null,
                    data.favorite ? 1 : 0,
                    data.id
                ];
                await connection.execute(query, values);
                res.status(200).json({ message: 'Project updated' });
                break;
            }
            case 'DELETE': {
                const id = req.query.id;
                if (!id) {
                    res.status(400).json({ error: 'Project ID is required' });
                    break;
                }
                await connection.execute('DELETE FROM share_projects WHERE id = ?', [id]);
                res.status(200).json({ message: 'Project deleted' });
                break;
            }
            default: {
                res.status(405).json({ error: 'Method not allowed' });
                break;
            }
        }

        await connection.end();

    } catch (error) {
        console.error("Database connection/query error:", error);
        res.status(500).json({ error: "Backend error", message: error.message });
    }
};
