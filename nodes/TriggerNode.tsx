/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Custom React Flow node for trigger/start steps
// Rounded rectangle with play icon, no input handle, one output handle (bottom)

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

type TriggerNodeData = {
    label: string;
    type?: string;
};

type TriggerFlowNode = Node<TriggerNodeData, 'trigger'>;

export const TriggerNode = memo(function TriggerNode({ data, selected }: NodeProps<TriggerFlowNode>) {
    return (
        <div className={`workflow-node workflow-node-trigger ${selected ? 'selected' : ''}`}>
            <div className="workflow-node-icon">&#x25B6;</div>
            <div className="workflow-node-label">{data.label}</div>
            <Handle type="source" position={Position.Bottom} className="workflow-handle" />
        </div>
    );
});
