/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Custom React Flow node for decision/gateway steps
// Diamond shape with condition label, one input (top), multiple outputs (bottom/sides)

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

type GatewayNodeData = {
    label: string;
    type?: string;
};

type GatewayFlowNode = Node<GatewayNodeData, 'gateway'>;

export const GatewayNode = memo(function GatewayNode({ data, selected }: NodeProps<GatewayFlowNode>) {
    return (
        <div className={`workflow-node workflow-node-gateway ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} className="workflow-handle" />
            <div className="workflow-node-diamond">
                <div className="workflow-node-label">{data.label}</div>
            </div>
            <Handle type="source" position={Position.Bottom} id="bottom" className="workflow-handle" />
            <Handle type="source" position={Position.Left} id="left" className="workflow-handle" />
            <Handle type="source" position={Position.Right} id="right" className="workflow-handle" />
        </div>
    );
});
