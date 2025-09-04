
import React, { useState } from 'react';
import { TextField, Grid, Paper, Typography, Button, Stack, Alert, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';

const API = process.env.REACT_APP_API || 'http://localhost:8080';

const emptyRow = () => ({ url: '', validity: '', shortcode: '' });

function isValidHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ShortenerPage() {
  const [rows, setRows] = useState([emptyRow()]);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const canAdd = rows.length < 5;

  const update = (i, field, value) => {
    const next = rows.slice();
    next[i][field] = value;
    setRows(next);
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const clearAll = () => { setRows([emptyRow()]); setResults([]); setError(''); };

  const submit = async () => {
    setError('');
    // client-side validation
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!isValidHttpUrl(r.url)) return setError(`Row ${i+1}: "url" must be a valid http/https URL`);
      if (r.validity && (!/^\d+$/.test(String(r.validity)) || parseInt(r.validity) <= 0)) {
        return setError(`Row ${i+1}: "validity" must be a positive integer (minutes)`);
      }
      if (r.shortcode && !/^[a-zA-Z0-9_-]{3,32}$/.test(r.shortcode)) {
        return setError(`Row ${i+1}: "shortcode" must be alphanumeric (plus _ or -), length 3-32`);
      }
    }

    try {
      const responses = await Promise.all(rows.map(r =>
        fetch(`${API}/shorturls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: r.url,
            validity: r.validity ? parseInt(r.validity) : undefined,
            shortcode: r.shortcode || undefined
          })
        }).then(async res => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to create');
          return data;
        })
      ));
      setResults(responses);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Shorten up to 5 URLs</Typography>
      <Stack spacing={2}>
        {rows.map((r, i) => (
          <Grid container spacing={2} key={i}>
            <Grid item xs={12}>
              <TextField label="Long URL" fullWidth value={r.url} onChange={e => update(i, 'url', e.target.value)} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField label="Validity (minutes)" fullWidth value={r.validity} onChange={e => update(i, 'validity', e.target.value)} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField label="Preferred Shortcode" fullWidth value={r.shortcode} onChange={e => update(i, 'shortcode', e.target.value)} />
            </Grid>
          </Grid>
        ))}
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" disabled={!canAdd} onClick={addRow}>Add another</Button>
          <Button variant="contained" onClick={submit}>Create Short Links</Button>
          <Button onClick={clearAll}>Clear</Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {results.length > 0 && (
          <>
            <Typography variant="h6" sx={{ mt: 2 }}>Results</Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Original URL</TableCell>
                  <TableCell>Short Link</TableCell>
                  <TableCell>Expiry</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((res, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{rows[idx].url}</TableCell>
                    <TableCell><a href={res.shortLink} target="_blank" rel="noreferrer">{res.shortLink}</a></TableCell>
                    <TableCell>{new Date(res.expiry).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Stack>
    </Paper>
  );
}
