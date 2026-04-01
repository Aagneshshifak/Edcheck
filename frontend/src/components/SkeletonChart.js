import React from 'react';
import { Skeleton } from '@mui/material';

const SkeletonChart = ({ height = 220 }) => (
  <Skeleton variant="rectangular" width="100%" height={height} />
);

export default SkeletonChart;
