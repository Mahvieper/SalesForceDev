const SETUP_AUDIT_FIELDS = {
    always: ['Id', 'CreatedDate', 'CreatedBy.Name', 'Section', 'Action', 'Display'],
    optional: ['DelegateUser', 'Status'],
    filters: {
        userId: 'CreatedById',
        status: 'Status',
        search: null
    }
};

class SalesforceAPI {
    constructor(instanceUrl, accessToken) {
        this.instanceUrl = instanceUrl.replace(/\/$/, '');
        this.accessToken = accessToken;
        this.apiVersion = '58.0';
        this._describeCache = null;
    }

    async request(path) {
        const url = `${this.instanceUrl}${path}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status;
            if (response.status === 401) error.code = 'INVALID_SESSION_ID';
            throw error;
        }
        return response.json();
    }

    async getAvailableFields(objectName) {
        if (this._describeCache) return this._describeCache;
        const describe = await this.request(`/services/data/v${this.apiVersion}/sobjects/${objectName}/describe`);
        const fieldNames = new Set(describe.fields.map(f => f.name));
        this._describeCache = fieldNames;
        return fieldNames;
    }

    async query(queryString) {
        const url = `${this.instanceUrl}/services/data/v${this.apiVersion}/query/?q=${encodeURIComponent(queryString)}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                const error = new Error(`HTTP error! status: ${response.status}`);
                error.status = response.status;
                if (response.status === 401) {
                    error.code = 'INVALID_SESSION_ID';
                }
                throw error;
            }

            return await response.json();
        } catch (error) {
            console.error('Salesforce API Error:', error);
            throw error;
        }
    }

    async getAuditLogs(filters) {
        const availableFields = await this.getAvailableFields('SetupAuditTrail');

        const selectFields = [...SETUP_AUDIT_FIELDS.always];
        for (const field of SETUP_AUDIT_FIELDS.optional) {
            if (availableFields.has(field)) selectFields.push(field);
        }

        let queryString = `SELECT ${selectFields.join(', ')} FROM SetupAuditTrail`;
        let whereClauses = [];

        if (filters.startDate) {
            const startDateFormatted = this.formatDateForSOQL(filters.startDate);
            whereClauses.push(`CreatedDate >= ${startDateFormatted}`);
        }
        if (filters.endDate) {
            const endDateFormatted = this.formatDateForSOQL(filters.endDate);
            whereClauses.push(`CreatedDate <= ${endDateFormatted}`);
        }

        if (filters.userId) {
            whereClauses.push(`CreatedById = '${filters.userId}'`);
        }

        if (filters.status && availableFields.has('Status')) {
            whereClauses.push(`Status = '${filters.status}'`);
        }

        if (filters.search) {
            const searchTerm = filters.search.replace(/'/g, "\\'");
            whereClauses.push(`(CreatedBy.Name LIKE '%${searchTerm}%' OR Action LIKE '%${searchTerm}%')`);
        }

        if (whereClauses.length > 0) {
            queryString += ' WHERE ' + whereClauses.join(' AND ');
        }

        queryString += ' ORDER BY CreatedDate DESC';
        
        if (filters.limit) {
            queryString += ` LIMIT ${filters.limit}`;
        }
        if (filters.offset) {
            queryString += ` OFFSET ${filters.offset}`;
        }

        try {
            const result = await this.query(queryString);
            return {
                records: result.records,
                totalSize: result.totalSize,
                done: result.done,
                fields: selectFields
            };
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            throw error;
        }
    }

    async getUsers() {
        const queryString = `SELECT Id, Name, Email FROM User WHERE IsActive = true ORDER BY Name`;
        
        try {
            const result = await this.query(queryString);
            return result.records;
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    }

    async getTotalAuditLogCount(filters) {
        const availableFields = await this.getAvailableFields('SetupAuditTrail');
        let queryString = `SELECT COUNT() FROM SetupAuditTrail`;
        let whereClauses = [];

        if (filters.startDate) {
            const startDateFormatted = this.formatDateForSOQL(filters.startDate);
            whereClauses.push(`CreatedDate >= ${startDateFormatted}`);
        }
        if (filters.endDate) {
            const endDateFormatted = this.formatDateForSOQL(filters.endDate);
            whereClauses.push(`CreatedDate <= ${endDateFormatted}`);
        }
        if (filters.userId) {
            whereClauses.push(`CreatedById = '${filters.userId}'`);
        }
        if (filters.status && availableFields.has('Status')) {
            whereClauses.push(`Status = '${filters.status}'`);
        }
        if (filters.search) {
            const searchTerm = filters.search.replace(/'/g, "\\'");
            whereClauses.push(`(CreatedBy.Name LIKE '%${searchTerm}%' OR Action LIKE '%${searchTerm}%')`);
        }

        if (whereClauses.length > 0) {
            queryString += ' WHERE ' + whereClauses.join(' AND ');
        }

        try {
            const result = await this.query(queryString);
            return result.totalSize;
        } catch (error) {
            console.error('Error getting count:', error);
            throw error;
        }
    }

    formatDateForSOQL(dateString) {
        const date = new Date(dateString);
        return date.toISOString().replace('.000', '');
    }
}