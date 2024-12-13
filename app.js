require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const app = express();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("Error: Missing EMAIL_USER or EMAIL_PASS in .env file");
    process.exit(1);
}

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Home Route: List all notes with pagination
app.get("/", async (req, res) => {
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
});

// Search Route: Search for notes
app.get("/search", async (req, res) => {
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
});

// Filter Route: Filter notes by tag or date range
app.get("/filter", async (req, res) => {
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
});

// Show Specific Note by ID
app.get("/notes/:id", async (req, res) => {
    const note = await prisma.note.findUnique({
        where: { id: parseInt(req.params.id) },
    });

    if (note && !note.deleted) {
        res.json(note);
    } else {
        res.status(404).send("Note not found");
    }
});

// Create Note Route
app.post("/", async (req, res) => {
    const { noteContent, tags = '' } = req.body;
    if (!noteContent.trim()) {
        return res.redirect('/');
    }

    const newNote = await prisma.note.create({
        data: {
            noteContent,
            tags: tags.split(',').map(tag => tag.trim()),
            sharedWith: [],
        },
    });

    res.redirect('/');
});

// Update Note Route
app.post('/update', async (req, res) => {
    const { noteId, noteContent, tags } = req.body;
    const note = await prisma.note.findUnique({ where: { id: parseInt(noteId) } });

    if (note) {
        await prisma.note.update({
            where: { id: parseInt(noteId) },
            data: {
                noteContent: noteContent.trim() || note.noteContent,
                tags: tags ? tags.split(',').map(tag => tag.trim()) : note.tags,
                updatedAt: new Date(),
            },
        });
    }
    res.redirect('/');
});

// Delete Note Route
app.post('/delete', async (req, res) => {
    const { noteId } = req.body; // This gets the noteId from the form submission

    console.log(req.body);  // Log to ensure noteId is being received correctly

    if (!noteId) {
        return res.status(400).send("Note ID is required");
    }

    try {
        // Find the note by noteId
        const note = await prisma.note.findUnique({
            where: {
                id: parseInt(noteId), // Ensure the noteId is an integer
            },
        });

        if (!note) {
            return res.status(404).send("Note not found");
        }

        // Perform the delete operation (or soft delete if needed)
        await prisma.note.delete({
            where: {
                id: parseInt(noteId),
            },
        });

        res.redirect('/'); // Redirect to the homepage after deletion
    } catch (error) {
        console.error("Error deleting note:", error);
        res.status(500).send("Failed to delete note");
    }
});

// Share Note Route (via email)
app.post("/share", (req, res) => {
    const { noteId, email, userId } = req.body;

    prisma.note.findUnique({
        where: { id: parseInt(noteId) },
    }).then(note => {
        if (!note) {
            return res.status(404).send("Note not found");
        }

        if (userId) {
            note.sharedWith.push(userId);
        }

        if (email) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'A Note Has Been Shared With You',
                text: `Hello,\n\nA note has been shared with you:\n\n${note.noteContent}\n\nTags: ${note.tags.join(', ') || 'None'}\n\nBest regards,\nNotes App`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                    return res.status(500).send("Failed to send email");
                }
                console.log('Email sent: ' + info.response);
                res.redirect('/');
            });
        } else {
            res.redirect('/');
        }
    });
});

app.listen(3000, () => {
    console.log("App is running on port 3000");
});
