/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Custom React Flow node for task steps
// Rounded rectangle with label, one input handle (top), one output handle (bottom)

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

type TaskNodeData = {
    label: string;
    type?: string;
};

type TaskFlowNode = Node<TaskNodeData, 'task'>;

export const TaskNode = memo(function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
    return (
        <div className={`workflow-node workflow-node-task ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} className="workflow-handle" />
            <div className="workflow-node-icon">&#x25A0;</div>
            <div className="workflow-node-label">{data.label}</div>
            <Handle type="source" position={Position.Bottom} className="workflow-handle" />
        </div>
    );
});
