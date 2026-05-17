const { Telegraf, Markup } = require('telegraf');
const express = require('express'); // 24/7 ishlashi uchun veb-server

const BOT_TOKEN = '8871778059:AAH26_U6wn-9cmNnRIjiCUxHpxlp3MzRq3k';
const ADMIN_ID = 8753197896; 
const GURUH_ID = -1003665140495; 
const KANAL_ID = -1003743236897;

const bot = new Telegraf(BOT_TOKEN);

let adminState = {}; 
let joriyPollId = null;
let foydalanuvchiBallari = {}; 

const adminKeyboard = Markup.keyboard([
    ['➕ Yangi Test Yaratish', '📊 Natijalarni Ko\'rish'],
    ['🚀 Testni Guruhga va Kanalga Yuborish']
]).resize();

bot.command('start', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('Salom! Men guruhlarda test o\'tkazadigan botman.');
    adminState = {}; 
    return ctx.reply('Xush kelibsiz, Admin! Quyidagi paneldan foydalaning:', adminKeyboard);
});

bot.command('done', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    if (adminState.step !== 'kutish_variantlar') return ctx.reply('❌ Hozir variant kiritish bosqichida emassiz!');
    if (!adminState.variantlar || adminState.variantlar.length < 2) {
        return ctx.reply('❌ Kamida 2 ta variant bo\'lishi shart!');
    }

    adminState.step = 'kutish_togri';
    ctx.reply(`🎯 **3-Qadam:** To'g'ri javob raqamini kiriting (1 dan ${adminState.variantlar.length} gacha bo'lgan son):`);
});

bot.hears('➕ Yangi Test Yaratish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState = { step: 'kutish_savol', savol: '', variantlar: [] };
    ctx.reply('📝 **1-Qadam:** Test savolini yuboring:', Markup.keyboard([['❌ Bekor qilish']]).resize());
});

bot.hears('❌ Bekor qilish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState = {};
    ctx.reply('Jarayon bekor qilindi.', adminKeyboard);
});

bot.hears('📊 Natijalarni Ko\'rish', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    
    const userlar = Object.values(foydalanuvchiBallari);
    if (userlar.length === 0) {
        return ctx.reply('📊 Hozircha hech kim test yechmadi yoki ballar mavjud emas.');
    }

    userlar.sort((a, b) => b.ball - a.ball);

    let reyting = "📊 **Foydalanuvchilar natijalari va umumiy reytingi:**\n\n";
    userlar.forEach((user, index) => {
        reyting += `${index + 1}. ${user.name} — 🏆 ${user.ball} ball\n`;
    });

    ctx.reply(reyting, { parse_mode: 'Markdown' });
});

bot.hears('🚀 Testni Guruhga va Kanalga Yuborish', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    if (adminState.step !== 'tayyor') return ctx.reply('❌ Avval yangi test yaratishingiz kerak!');

    try {
        const guruhPoll = await bot.telegram.sendQuiz(
            GURUH_ID,
            adminState.savol,
            adminState.variantlar,
            { correct_option_id: adminState.togriJavobId, is_anonymous: false }
        );

        joriyPollId = guruhPoll.poll.id;

        await bot.telegram.sendQuiz(
            KANAL_ID,
            adminState.savol,
            adminState.variantlar,
            { correct_option_id: adminState.togriJavobId, explanation: "Ushbu test guruhda o'tkazildi. Arxiv." }
        );

        ctx.reply('🚀 Test guruhga va arxiv kanaliga muvaffaqiyatli joylandi! Natijalarni istalgan vaqtda panel orqali ko\'rishingiz mumkin.', adminKeyboard);
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Xatolik yuz berdi! ID larni yoki bot adminligini tekshiring.');
    }
});

bot.on('poll_answer', (ctx) => {
    const answer = ctx.pollAnswer;
    
    if (answer.poll_id === joriyPollId && adminState.step === 'tayyor') {
        const userId = answer.user.id;
        const userName = answer.user.first_name || "Foydalanuvchi";
        const tanlanganVariant = answer.option_ids[0]; // Massiv ichidagi birinchi indeks olinadi
        
        if (tanlanganVariant === adminState.togriJavobId) {
            if (!foydalanuvchiBallari[userId]) {
                foydalanuvchiBallari[userId] = { name: userName, ball: 0 };
            }
            foydalanuvchiBallari[userId].ball += 1; 
        }
    }
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const text = ctx.message.text;

    if (adminState.step === 'kutish_savol') {
        adminState.savol = text;
        adminState.step = 'kutish_variantlar';
        return ctx.reply('🔢 **2-Qadam:** Test variantlarini yuboring.\n\nTugatgach /done buyrug\'ini bosing.');
    }

    if (adminState.step === 'kutish_variantlar') {
        if (adminState.variantlar.length >= 10) return ctx.reply('❌ Ko\'pi bilan 10 ta variant bo\'lishi mumkin!');
        adminState.variantlar.push(text);
        return ctx.reply(`✅ Variant qo'shildi (${adminState.variantlar.length}/10). Keyingisi yoki /done`);
    }

    if (adminState.step === 'kutish_togri') {
        const index = parseInt(text) - 1;
        if (isNaN(index) || index < 0 || index >= adminState.variantlar.length) {
            return ctx.reply(`❌ 1 dan ${adminState.variantlar.length} gacha son kiriting:`);
        }

        adminState.togriJavobId = index;
        adminState.step = 'tayyor';
        
        let ko_rinish = `🎉 **Test tayyor!**\n\n**Savol:** ${adminState.savol}\n**Variantlar:**\n`;
        adminState.variantlar.forEach((v, i) => {
            ko_rinish += `${i + 1}) ${v} ${i === index ? '✅' : ''}\n`;
        });

        return ctx.reply(ko_rinish, adminKeyboard);
    }
});

// Render uchun Express server sozlamalari
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot status: ONLINE (24/7)');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

bot.launch().then(() => console.log('Bot muvaffaqiyatli ishga tushdi!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));