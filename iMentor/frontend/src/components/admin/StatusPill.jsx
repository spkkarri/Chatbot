// frontend/src/components/admin/StatusPill.jsx
import React from 'react';
import { CheckCircle, Loader2, XCircle, RefreshCw } from 'lucide-react';
import IconButton from '../core/IconButton';

const StatusPill = ({ stage, onRestart }) => {
    if (!stage) {
        return <span className="text-xs text-gray-400">Pending</span>;
    }

    const { status, message } = stage;

    const config = {
        pending: { Icon: Loader2, color: 'text-gray-400', label: 'Pending' },
        processing: { Icon: Loader2, color: 'text-blue-500 animate-spin', label: 'Processing' },
        completed: { Icon: CheckCircle, color: 'text-green-500', label: 'Completed' },
        failed: { Icon: XCircle, color: 'text-red-500', label: 'Failed' },
    };

    const { Icon, color, label } = config[status] || config.pending;

    const handleRestartClick = (e) => {
        e.stopPropagation();
        onRestart();
    };

    return (
        <div className="flex items-center justify-center gap-2 group" title={message || label}>
            <Icon size={16} className={color} />
            {status === 'failed' && onRestart && (
                <IconButton
                    icon={RefreshCw}
                    size="sm"
                    onClick={handleRestartClick}
                    title="Restart Process"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
            )}
        </div>
    );
};

export default StatusPill;
