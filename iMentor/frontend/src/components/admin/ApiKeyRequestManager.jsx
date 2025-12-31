// frontend/src/components/admin/ApiKeyRequestManager.jsx
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import adminApi from '../../services/adminApi.js';
import IconButton from '../core/IconButton.jsx';

function ApiKeyRequestManager({ requests, onAction }) {
    const [loadingStates, setLoadingStates] = useState({});

    const handleAction = async (userId, action) => {
        setLoadingStates(prev => ({ ...prev, [userId]: true }));
        const toastId = toast.loading(`${action === 'approve' ? 'Approving' : 'Rejecting'} request...`);
        
        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders();
            let response;
            if (action === 'approve') {
                response = await adminApi.approveApiKeyRequest(userId, authHeaders);
            } else {
                response = await adminApi.rejectApiKeyRequest(userId, authHeaders);
            }
            toast.success(response.message, { id: toastId });
            onAction(); // Trigger a refresh in the parent component
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setLoadingStates(prev => ({ ...prev, [userId]: false }));
        }
    };

    return (
        <div className="card-base p-0 sm:p-4 mt-6">
            <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark px-4 sm:px-0 pt-4 sm:pt-0">
                Pending API Key Requests
            </h2>
            {requests.length === 0 ? (
                <p className="text-center text-sm text-text-muted-light dark:text-text-muted-dark py-6 px-4 sm:px-0">
                    No pending requests.
                </p>
            ) : (
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-4 py-2.5 font-medium">User Email</th>
                                <th className="px-4 py-2.5 font-medium hidden md:table-cell">Name</th>
                                <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Requested</th>
                                <th className="px-4 py-2.5 font-medium text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((req) => (
                                <tr key={req._id} className="border-b border-border-light dark:border-border-dark">
                                    <td className="px-4 py-2 font-mono text-xs" title={req.email}>{req.email}</td>
                                    <td className="px-4 py-2 hidden md:table-cell">{req.profile?.name || 'N/A'}</td>
                                    <td className="px-4 py-2 hidden lg:table-cell" title={new Date(req.createdAt).toLocaleString()}>
                                        {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                                    </td>
                                    <td className="px-4 py-2 text-center whitespace-nowrap">
                                        {loadingStates[req._id] ? (
                                            <Loader2 size={16} className="animate-spin text-primary inline-block" />
                                        ) : (
                                            <>
                                                <IconButton
                                                    icon={Check}
                                                    title="Approve Request"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-green-500 hover:text-green-700 dark:hover:text-green-400"
                                                    onClick={() => handleAction(req._id, 'approve')}
                                                />
                                                <IconButton
                                                    icon={X}
                                                    title="Reject Request"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                                    onClick={() => handleAction(req._id, 'reject')}
                                                />
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default ApiKeyRequestManager;