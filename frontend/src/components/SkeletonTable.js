import React from 'react';
import { Table, TableBody, TableRow, TableCell, Skeleton } from '@mui/material';

const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <Table>
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: cols }).map((_, colIdx) => (
            <TableCell key={colIdx}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default SkeletonTable;
