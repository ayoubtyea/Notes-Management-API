require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const app = express();

// Setting up Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Ensure EMAIL_USER and EMAIL_PASS are set in the environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Error: Missing EMAIL_USER or EMAIL_PASS in .env file");
    process.exit(1);
}

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Home Route: List all notes with pagination
app.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const totalNotes = await prisma.note.count({
            where: { deleted: false },
        });

        const totalPages = Math.ceil(totalNotes / limit);

        const paginatedNotes = await prisma.note.findMany({
            where: { deleted: false },
            skip: offset,
            take: limit,
        });

        res.render("home", {
            data: paginatedNotes,
            searchTerm: '',
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).send('Error fetching notes');
    }
});

// Search Route: Search for notes
app.get("/search", async (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        const filteredNotes = await prisma.note.findMany({
            where: {
                deleted: false,
                OR: [
                    { noteContent: { contains: searchTerm, mode: 'insensitive' } },
                    { tags: { hasSome: searchTerm.split(' ').map(tag => tag.trim()) } }
                ]
            }
        });
        res.render("home", { data: filteredNotes, searchTerm });
    } catch (error) {
        console.error('Error searching for notes:', error);
        res.status(500).send('Error searching for notes');
    }
});

// Filter Route: Filter notes by tag or date range
app.get("/filter", async (req, res) => {
    try {
        const { tag, startDate, endDate } = req.query;

        const filteredNotes = await prisma.note.findMany({
            where: {
                deleted: false,
                AND: [
                    tag ? { tags: { has: tag } } : {},
                    startDate || endDate ? {
                        updatedAt: {
                            gte: startDate ? new Date(startDate) : undefined,
                            lte: endDate ? new Date(endDate) : undefined
                        }
                    } : {}
                ]
            }
        });

        res.render("home", { data: filteredNotes, searchTerm: '' });
    } catch (error) {
        console.error('Error filtering notes:', error);
        res.status(500).send('Error filtering notes');
    }
});

// Show Specific Note by ID
app.get("/notes/:id", async (req, res) => {
    try {
        const note = await prisma.note.findUnique({
            where: { id: parseInt(req.params.id) },
        });

        if (note && !note.deleted) {
            res.json(note);
        } else {
            res.status(404).send("Note not found or deleted");
        }
    } catch (error) {
        console.error('Error fetching note by ID:', error);
        res.status(500).send('Error fetching note');
    }
});

// Create Note Route
app.post("/", async (req, res) => {
    try {
        const { noteContent, tags = '' } = req.body;
        if (!noteContent.trim()) {
            return res.status(400).send("Note content cannot be empty");
        }

        const newNote = await prisma.note.create({
            data: {
                noteContent,
                tags: tags.split(',').map(tag => tag.trim()),
                sharedWith: [],
            },
        });

        res.redirect('/');
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).send('Error creating note');
    }
});

// Update Note Route
app.post('/update', async (req, res) => {
    try {
        console.log("Request body:", req.body);  // Log the entire request body

        const { noteId, noteContent, tags } = req.body;
        console.log("Received noteId:", noteId);  // Log the noteId separately

        // Ensure noteId is valid
        if (!noteId || isNaN(Number(noteId)) || noteId === '') {
            return res.status(400).send("Invalid noteId"); // Validate if noteId is empty or non-numeric
        }

        const note = await prisma.note.findUnique({
            where: { id: parseInt(noteId) },
        });

        if (note) {
            const updatedNoteContent = noteContent ? noteContent.trim() : note.noteContent;
            const updatedTags = tags 
                ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) 
                : note.tags;

            await prisma.note.update({
                where: { id: parseInt(noteId) },
                data: {
                    noteContent: updatedNoteContent,
                    tags: updatedTags,
                    updatedAt: new Date(),
                },
            });
            res.status(200).send("Note updated successfully");
        } else {
            res.status(404).send("Note not found");
        }
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).send('Error updating note');
    }
});



// Delete Note Route (Soft Delete)
app.post('/delete', async (req, res) => {
    try {
        const { noteId } = req.body;

        if (!noteId) {
            return res.status(400).send("Note ID is required");
        }

        const note = await prisma.note.findUnique({
            where: {
                id: parseInt(noteId),
            },
        });

        if (!note) {
            return res.status(404).send("Note not found");
        }

        await prisma.note.update({
            where: {
                id: parseInt(noteId),
            },
            data: {
                deleted: true,
            }
        });

        res.redirect('/');
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).send("Failed to delete note");
    }
});

// Share Note Route (by email or userId)
app.post('/share', async (req, res) => {
    const { noteId, email, userId } = req.body;
    try {
        const note = await prisma.note.findUnique({ where: { id: parseInt(noteId) } });
        if (!note) return res.status(404).send('Note not found');

        if (email) {
            // Send email to user with note content
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: `Shared Note: ${note.title}`,
                text: note.noteContent,
            });
            return res.send('Note shared via email');
        }

        if (userId) {
            // Share with internal user (add to sharedWith array)
            await prisma.note.update({
                where: { id: parseInt(noteId) },
                data: {
                    sharedWith: { push: userId },
                },
            });
            return res.send('Note shared with user');
        }

        res.status(400).send("No email or user ID provided for sharing");
    } catch (error) {
        console.error('Error sharing note:', error);
        res.status(500).send('Error sharing note');
    }
});

// Start Server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
