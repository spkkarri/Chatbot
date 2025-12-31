// frontend/src/components/admin/UserChatManager.jsx
import React, { useState, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { User, MessageSquare, Clock, ChevronDown, AlertTriangle, Search } from 'lucide-react';

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return `${format(date, 'MMM d, yyyy HH:mm')} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch (e) {
        return 'Invalid Date';
    }
};

function UserChatManager({ usersWithChats }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) {
            return usersWithChats;
        }
        const lowercasedFilter = searchTerm.toLowerCase();
        return usersWithChats.filter(({ user }) => 
            (user.name && user.name.toLowerCase().includes(lowercasedFilter)) ||
            (user.email && user.email.toLowerCase().includes(lowercasedFilter))
        );
    }, [usersWithChats, searchTerm]);

    return (
        <div className="card-base p-0 sm:p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 px-4 sm:px-0 pt-4 sm:pt-0 gap-3">
                <h2 className="text-lg font-semibold text-text-light dark:text-text-dark flex-shrink-0">
                    User Chat Sessions
                </h2>
                <div className="relative w-full sm:w-auto sm:max-w-xs">
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field !py-2 !pl-9 !pr-3 text-sm w-full"
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted-light dark:text-text-muted-dark" />
                </div>
            </div>

            {filteredUsers.length === 0 ? (
                <p className="text-center text-sm text-text-muted-light dark:text-text-muted-dark py-6 px-4 sm:px-0">
                    {searchTerm ? `No users found matching "${searchTerm}".` : "No user chat data available."}
                </p>
            ) : (
                <div className="space-y-3">
                    {filteredUsers.map(({ user, sessions }) => {
                        return (
                            <details key={user._id} className="group bg-surface-light dark:bg-gray-800/50 border border-border-light dark:border-border-dark rounded-lg overflow-hidden transition-all duration-200 open:shadow-lg open:ring-1 open:ring-primary/50">
                                <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <User className="text-primary" size={18} />
                                        <div>
                                            <p className="font-semibold text-sm text-text-light dark:text-text-dark">{user.name || 'Unnamed User'}</p>
                                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">{sessions.length} sessions</span>
                                        <ChevronDown size={20} className="group-open:rotate-180 transition-transform" />
                                    </div>
                                </summary>
                                <div className="border-t border-border-light dark:border-border-dark p-3 space-y-2 bg-white dark:bg-gray-800">
                                    {sessions.length > 0 ? sessions.map(session => {
                                        const hasValidSummary = session.summary && !session.summary.startsWith('Summary generation failed:');
                                        const isErrorSummary = session.summary && session.summary.startsWith('Summary generation failed:');

                                        return (
                                            <div key={session.sessionId} className={`p-2.5 border rounded-md ${isErrorSummary ? 'border-red-500/30 bg-red-500/5' : 'border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-900/50'}`}>
                                                
                                                {hasValidSummary && (
                                                    <p className="text-xs font-medium text-text-light dark:text-text-dark italic" title={session.summary}>
                                                        "{session.summary}"
                                                    </p>
                                                )}
                                                
                                                {isErrorSummary && (
                                                     <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                                                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                                        <p className="text-xs font-semibold" title={session.summary}>
                                                            {session.summary}
                                                        </p>
                                                     </div>
                                                )}

                                                {!session.summary && (
                                                    <p className="text-xs text-center text-text-muted-light dark:text-text-muted-dark italic">
                                                        This session has not been summarized yet.
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between text-xs text-text-muted-light dark:text-text-muted-dark mt-2 pt-2 border-t border-dashed">
                                                    <span className="flex items-center gap-1"><MessageSquare size={12} /> {session.messageCount} msgs</span>
                                                    <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(session.updatedAt)}</span>
                                                </div>
                                            </div>
                                        )
                                    }) : <p className="text-xs text-center text-text-muted-light dark:text-text-muted-dark p-2">This user has no chat sessions.</p>}
                                </div>
                            </details>
                        )
                    })}
                </div>
            )}
        </div>
    );
}

export default UserChatManager;