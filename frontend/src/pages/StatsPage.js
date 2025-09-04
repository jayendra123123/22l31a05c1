
import React, { useEffect, useState } from 'react';
import { Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Accordion, AccordionSummary, AccordionDetails, Chip, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const API = process.env.REACT_APP_API || 'http://localhost:8080';

export default function StatsPage() {
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState('');
  const [details, setDetails] = useState({}); // code -> details

  useEffect(() => {
    fetch(`${API}/shorturls`)
      .then(r => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const handleExpand = async (code) => {
    const isOpen = expanded === code;
    setExpanded(isOpen ? '' : code);
    if (!isOpen && !details[code]) {
      const data = await fetch(`${API}/shorturls/${code}`).then(r => r.json());
      setDetails(prev => ({ ...prev, [code]: data }));
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Short URLs</Typography>
      {items.map(item => (
        <Accordion key={item.shortcode} expanded={expanded === item.shortcode} onChange={() => handleExpand(item.shortcode)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', justifyContent: 'space-between' }}>
              <Typography sx={{ flexGrow: 1 }}><a href={item.shortLink} target="_blank" rel="noreferrer">{item.shortLink}</a></Typography>
              <Chip label={`Clicks: ${item.totalClicks}`} />
              <Typography variant="body2">Created: {new Date(item.createdAt).toLocaleString()}</Typography>
              <Typography variant="body2">Expiry: {new Date(item.expiry).toLocaleString()}</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            {details[item.shortcode] ? (
              <>
                <Typography variant="subtitle1" gutterBottom>Click Details</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Referrer</TableCell>
                      <TableCell>Country</TableCell>
                      <TableCell>Region</TableCell>
                      <TableCell>City</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details[item.shortcode].clicks.map((c, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{new Date(c.timestamp).toLocaleString()}</TableCell>
                        <TableCell>{c.referrer || '-'}</TableCell>
                        <TableCell>{c.geo.country || '-'}</TableCell>
                        <TableCell>{c.geo.region || '-'}</TableCell>
                        <TableCell>{c.geo.city || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Paper>
  );
}
