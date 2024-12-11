const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid'); // Using UUID for unique IDs

const notes = [{
    noteId: uuidv4(),
    noteContent: "Add your note here.",
    tags: ['default'],
    
}];

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Home route to display all notes
app.get("/", (req, res) => {
    res.render("home", { data: notes, searchTerm: '' });
});

// Route to handle searching notes by title or content
app.get("/search", (req, res) => {
    const searchTerm = req.query.q || '';
    const filteredNotes = notes.filter(note =>
        note.noteContent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    res.render("home", { data: filteredNotes, searchTerm });
});

// Route to add a new note
app.post("/", (req, res) => {
    const { noteContent, tags = '' } = req.body;
    if (!noteContent.trim()) {
        return res.redirect('/'); // Redirect if noteContent is empty
    }

    const newNote = {
        noteId: uuidv4(),
        noteContent,
        tags: tags.split(',').map(tag => tag.trim())
    };

    notes.push(newNote);
    res.redirect('/');
});

// Route to update an existing note
app.post('/update', (req, res) => {
    const { noteId, noteContent, tags } = req.body;

    const note = notes.find(n => n.noteId === noteId);

    if (note) {
        note.noteContent = noteContent.trim() || note.noteContent;
        note.tags = tags ? tags.split(',').map(tag => tag.trim()) : note.tags;
    }

    res.redirect('/');
});

// Route to delete a note
app.post('/delete', (req, res) => {
    const { noteId } = req.body;

    const noteIndex = notes.findIndex(note => note.noteId === noteId);
    if (noteIndex !== -1) {
        notes.splice(noteIndex, 1); // Remove the note at the found index
    }

    res.redirect('/');
});

// Start the server
app.listen(3000, () => {
    console.log("App is running on port 3000");
});
