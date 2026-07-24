# -*- coding: utf-8 -*-
"""
Dil Haritasi - Ogretmen Destek Bilgi Tabani ureticisi.
Girdi : excelveri.json (13.884 EN-TR cumle cifti)
Cikti : teacher-kb.json, teacher-kb.js, sentences.tagged.json
Mantik: her gramer konusu icin TR/EN kural + regex desen tanimli.
        Cumleler desenlerle etiketlenir, her konuya gercek ornekler eklenir.
Not   : Kural metinleri ozgun (paraphrase) yazildi; ornekler excelveri'den gelir.
"""
import json, re, io, sys, datetime

UP = "/home/claude/excelveri.json"
OUT = "/home/claude/out_kb/"

# ---- ortak parcalar ----
IRREG = ("been|gone|done|seen|made|come|taken|given|written|spoken|broken|eaten|"
         "driven|known|grown|shown|thrown|worn|chosen|forgotten|hidden|ridden|risen|"
         "fallen|drawn|flown|begun|drunk|sung|swum|run|become|brought|bought|caught|"
         "taught|thought|found|got|gotten|held|kept|left|lost|met|paid|put|read|said|"
         "sold|sent|sat|slept|spent|stood|told|understood|won|felt|built|heard|led|"
         "meant|set|cut|hit|let|shut|cost|hurt|lent|sent|swept|stolen|beaten")
PART = r"(?:" + IRREG + r"|[a-z]+ed)"   # V3 (duzenli veya duzensiz)

# ---- KONU TAKSONOMISI ----
# her konu: id, tr, en, cefr, azar, formula, rule_tr, rule_en, kw (soru anahtar kelimeleri), pats (regex)
TOPICS = [
 dict(id="present_simple", tr="Geniş Zaman (Simple Present)", en="Simple Present", cefr="A1", azar="Böl. 2 (2-1)",
   formula="V1 / V+(e)s  •  do/does + not + V1",
   rule_tr="Alışkanlıkları, tekrar eden eylemleri ve genel doğruları anlatır. Üçüncü tekil şahısta (he/she/it) fiile -s/-es eklenir. Olumsuz ve soruda do/does yardımcı fiili kullanılır.",
   rule_en="Used for habits, routines and general truths. Add -s/-es for he/she/it. Use do/does for negatives and questions.",
   kw=["geniş zaman","simple present","present simple","alışkanlık","-s takısı","do does"],
   pats=[r"\b(always|usually|often|sometimes|never|every day|every week)\b",
         r"\b(do|does)\s+not\b", r"\b(don't|doesn't)\b", r"^\s*(do|does)\b"]),

 dict(id="present_progressive", tr="Şimdiki Zaman (Present Continuous)", en="Present Continuous", cefr="A1", azar="Böl. 2 (2-2)",
   formula="am/is/are + V-ing",
   rule_tr="Şu an konuşma anında olan veya geçici olan eylemleri anlatır. 'be' fiili (am/is/are) + fiilin -ing hali ile kurulur.",
   rule_en="Describes actions happening now or temporary situations. Formed with am/is/are + verb-ing.",
   kw=["şimdiki zaman","present continuous","present progressive","-ing","şu an"],
   pats=[r"\b(am|is|are)\s+(not\s+)?[a-z]+ing\b", r"\b(right now|at the moment)\b"]),

 dict(id="past_simple", tr="Geçmiş Zaman (Simple Past)", en="Simple Past", cefr="A1", azar="Böl. 2 (2-5)",
   formula="V2  •  did + not + V1",
   rule_tr="Geçmişte bitmiş, belirli bir zamanda olmuş eylemleri anlatır. Düzenli fiillere -ed eklenir; düzensiz fiillerin ikinci hali (V2) kullanılır. Olumsuz/soruda 'did' kullanılır.",
   rule_en="Describes finished actions at a definite past time. Add -ed to regular verbs; use V2 for irregulars. Use 'did' for negatives/questions.",
   kw=["geçmiş zaman","simple past","past simple","-ed","ikinci hal","v2","did"],
   pats=[r"\b(yesterday|ago|last (week|year|night|month)|in \d{4})\b",
         r"\b(did)\s+not\b", r"\bdidn't\b", r"^\s*did\b",
         r"\b(went|saw|came|took|made|got|said|found|gave|told|knew|thought|left|felt|bought|brought)\b"]),

 dict(id="past_progressive", tr="Sürekli Geçmiş Zaman (Past Continuous)", en="Past Continuous", cefr="A2", azar="Böl. 2 (2-6)",
   formula="was/were + V-ing",
   rule_tr="Geçmişte belirli bir anda devam etmekte olan eylemi anlatır; çoğunlukla başka bir olayla kesişir (while ... when ...).",
   rule_en="An action in progress at a moment in the past, often interrupted by another (while ... when ...).",
   kw=["past continuous","past progressive","sürekli geçmiş","was were -ing"],
   pats=[r"\b(was|were)\s+(not\s+)?[a-z]+ing\b"]),

 dict(id="present_perfect", tr="Yakın Geçmiş (Present Perfect)", en="Present Perfect", cefr="A2-B1", azar="Böl. 3 (3-1)",
   formula="have/has + V3",
   rule_tr="Geçmişte olup şimdiyle bağı olan, zamanı belirtilmemiş deneyimleri ve yeni bitmiş eylemleri anlatır. have/has + fiilin üçüncü hali (V3) ile kurulur. Sık kullanılan işaretler: ever, never, already, yet, just, since, for.",
   rule_en="Links past to present: experiences with no stated time and recently finished actions. Formed with have/has + past participle (V3). Signals: ever, never, already, yet, just, since, for.",
   kw=["present perfect","yakın geçmiş","have has","üçüncü hal","v3","ever never already yet just since for"],
   pats=[r"\b(has|have)\s+(not\s+|never\s+|already\s+|just\s+|ever\s+)?" + PART + r"\b",
         r"\b(has|have)\s+\w+\s+" + PART + r"\b",
         r"\b(hasn't|haven't)\s+" + PART + r"\b",
         r"\b(since|already|yet|ever|never)\b.*\b(has|have)\b",
         r"\b(has|have)\b.*\b(yet|already|ever|never|since|for)\b"]),

 dict(id="present_perfect_prog", tr="Yakın Geçmiş Sürekli (Present Perfect Continuous)", en="Present Perfect Continuous", cefr="B1", azar="Böl. 3 (3-2)",
   formula="have/has + been + V-ing",
   rule_tr="Geçmişte başlayıp hâlâ süren ya da az önce durmuş, süresi vurgulanan eylemi anlatır. have/has + been + fiil-ing.",
   rule_en="An action that started in the past and is still going (or just stopped), emphasizing duration. have/has + been + verb-ing.",
   kw=["present perfect continuous","perfect progressive","been -ing","süre"],
   pats=[r"\b(has|have)\s+been\s+[a-z]+ing\b"]),

 dict(id="past_perfect", tr="Miş'li Geçmiş (Past Perfect)", en="Past Perfect", cefr="B1", azar="Böl. 3 (3-3)",
   formula="had + V3",
   rule_tr="Geçmişteki bir olaydan DAHA ÖNCE olmuş ikinci bir olayı anlatır. had + fiilin üçüncü hali (V3).",
   rule_en="Describes an action that happened before another past action. had + past participle (V3).",
   kw=["past perfect","geçmişin geçmişi","had v3","daha önce"],
   pats=[r"\bhad\s+(not\s+|already\s+|never\s+|just\s+)?" + PART + r"\b", r"\bhadn't\s+" + PART + r"\b",
         r"\bby the time\b"]),

 dict(id="future", tr="Gelecek Zaman (Future)", en="Future (will / be going to)", cefr="A1-A2", azar="Böl. 4 (4-1)",
   formula="will + V1  •  am/is/are + going to + V1",
   rule_tr="Gelecekteki eylemleri anlatır. Anlık kararlar/tahminler için 'will'; planlar ve güçlü belirtiler için 'be going to' kullanılır.",
   rule_en="Talks about the future. Use 'will' for instant decisions/predictions; 'be going to' for plans and evidence.",
   kw=["gelecek zaman","future","will","be going to","gelecek"],
   pats=[r"\b(will|shall)\s+(not\s+)?[a-z]+\b", r"\bwon't\b", r"\b(is|are|am)\s+going\s+to\s+[a-z]+\b",
         r"\b(tomorrow|next (week|year|month))\b"]),

 dict(id="modals", tr="Kip Fiilleri (Modals)", en="Modals", cefr="A2-B1", azar="Böl. 9-10",
   formula="modal + V1 (can, could, may, might, must, should, have to, ought to)",
   rule_tr="Yetenek, izin, olasılık, zorunluluk ve tavsiye bildirir. Kip fiilinden sonra fiilin yalın hali (V1) gelir; -s takısı almaz. Örn: can (yapabilme), must/have to (zorunluluk), should (tavsiye), may/might (olasılık).",
   rule_en="Express ability, permission, possibility, obligation and advice. Followed by the base verb (V1). e.g. can (ability), must/have to (obligation), should (advice), may/might (possibility).",
   kw=["modal","kip fiil","can could","must","should","may might","have to","zorunluluk","tavsiye","olasılık","yetenek"],
   pats=[r"\b(can|can't|cannot|could|couldn't|may|might|must|mustn't|should|shouldn't|ought\s+to|had\s+better)\b",
         r"\b(have|has|had)\s+to\s+[a-z]+\b"]),

 dict(id="passive", tr="Edilgen Çatı (Passive Voice)", en="Passive Voice", cefr="B1", azar="Böl. 11 (11-1)",
   formula="be + V3  (+ by ...)",
   rule_tr="Eylemi yapan değil, eylemden etkilenen öne çıkarılır. 'be' fiili (uygun zamanda) + fiilin üçüncü hali (V3). Yapan kişi gerekiyorsa 'by' ile eklenir.",
   rule_en="Focus on the receiver of the action, not the doer. Form: be (in the right tense) + past participle (V3); add the doer with 'by'.",
   kw=["edilgen","passive","pasif","be v3","by","çatı"],
   pats=[r"\b(is|are|was|were|be|been|being|am)\s+(not\s+)?" + PART + r"\s+by\b",
         r"\b(is|are|was|were)\s+(not\s+)?" + PART + r"\b(?!\s*ing)"]),

 dict(id="conditionals", tr="Koşul Cümleleri (Conditionals)", en="Conditionals (if-clauses)", cefr="B1-B2", azar="Böl. 20",
   formula="If + koşul, sonuç  (0/1/2/3. tip)",
   rule_tr="'if' ile bir koşulu ve sonucunu bağlar. Tip 1 (gerçek/olası): If + present, will + V1. Tip 2 (hayali/şimdi): If + past, would + V1. Tip 3 (geçmiş pişmanlık): If + had V3, would have V3.",
   rule_en="Link a condition and its result with 'if'. Type 1 (real): If + present, will + V1. Type 2 (unreal now): If + past, would + V1. Type 3 (past): If + had V3, would have V3.",
   kw=["koşul","conditional","if","if clause","şart cümlesi","would","unless"],
   pats=[r"\bif\b.*\b(will|would|could|might|had|were|'d)\b", r"\bunless\b", r"\bwould\s+have\s+" + PART + r"\b"]),

 dict(id="wish", tr="Wish / Keşke Cümleleri", en="Wish", cefr="B2", azar="Böl. 20 (20-6)",
   formula="wish + past / past perfect",
   rule_tr="Gerçekleşmesi istenen ama olmayan durumları ('keşke') anlatır. Şimdi için: wish + past (I wish I knew). Geçmiş pişmanlık için: wish + had V3 (I wish I had known).",
   rule_en="Expresses 'if only' about unreal situations. Present: wish + past. Past regret: wish + had V3.",
   kw=["wish","keşke","if only","dilek"],
   pats=[r"\bwish(es|ed)?\b", r"\bif only\b"]),

 dict(id="comparatives", tr="Karşılaştırma (Comparatives & Superlatives)", en="Comparatives & Superlatives", cefr="A2", azar="Böl. -",
   formula="-er than / more ... than  •  the -est / the most ...",
   rule_tr="İki şeyi karşılaştırmak için kısa sıfata -er + than, uzun sıfata more + than eklenir. En üstünlük için the + -est ya da the most kullanılır.",
   rule_en="Compare two things with -er + than (short adj.) or more + than (long adj.). Superlative: the + -est or the most.",
   kw=["karşılaştırma","comparative","superlative","than","more","-er","-est","en üstünlük"],
   pats=[r"\b[a-z]+er\s+than\b", r"\bmore\s+[a-z]+\s+than\b", r"\bthe\s+most\s+[a-z]+\b", r"\bthe\s+[a-z]+est\b", r"\bas\s+[a-z]+\s+as\b"]),

 dict(id="relative_clauses", tr="Sıfat Cümlecikleri (Relative Clauses)", en="Adjective / Relative Clauses", cefr="B1", azar="Böl. 13",
   formula="who / which / that / whose / whom / where",
   rule_tr="Bir ismi tanımlayan yan cümlelerdir. İnsan için who/that, nesne için which/that, iyelik için whose, yer için where kullanılır.",
   rule_en="Clauses that describe a noun. Use who/that for people, which/that for things, whose for possession, where for places.",
   kw=["sıfat cümleciği","relative clause","adjective clause","who which that","whose","ilgi zamiri"],
   pats=[r"\b(the|a|an|[A-Z][a-z]+)\s+[a-z]+\s+(who|which|that|whose|whom)\b",
         r"\bthe\s+[a-z]+\s+(where|when)\b"]),

 dict(id="noun_clauses", tr="İsim Cümlecikleri (Noun Clauses)", en="Noun Clauses", cefr="B1-B2", azar="Böl. 12",
   formula="that / what / whether / if / wh- + cümle",
   rule_tr="Bir ismin yerini tutan yan cümlelerdir; çoğunlukla think, know, believe, wonder gibi fiillerden sonra gelir. that, what, whether/if ve soru sözcükleriyle başlar.",
   rule_en="Clauses that act like a noun, usually after verbs like think, know, believe, wonder. Begin with that, what, whether/if or wh-words.",
   kw=["isim cümleciği","noun clause","that what whether","dolaylı"],
   pats=[r"\b(know|knows|knew|think|thinks|believe|said|say|says|wonder|hope|sure|realize|understand|remember)\s+(that|what|whether|if|why|how|where|when|who)\b"]),

 dict(id="adverb_clauses", tr="Zarf Cümlecikleri (Adverb Clauses)", en="Adverb Clauses", cefr="B1", azar="Böl. 17",
   formula="because / although / while / when / so that ...",
   rule_tr="Sebep, zıtlık, zaman veya amaç bildiren yan cümlelerdir: because (çünkü), although/though (-e rağmen), while (iken), so that (amacıyla).",
   rule_en="Clauses of reason, contrast, time or purpose: because, although/though, while, so that.",
   kw=["zarf cümleciği","adverb clause","because","although","while","so that","bağlaç"],
   pats=[r"\b(because|although|though|even though|whereas|so that|as soon as|as long as|whenever|wherever)\b"]),

 dict(id="gerund_infinitive", tr="Gerund ve Mastar (Gerund / Infinitive)", en="Gerunds & Infinitives", cefr="B1", azar="Böl. 14-15",
   formula="verb + V-ing  ya da  verb + to + V1",
   rule_tr="Bazı fiillerden sonra -ing (enjoy, avoid, finish, mind), bazılarından sonra to + fiil (want, decide, hope, need) gelir. Amaç bildirmek için 'to + fiil' (in order to) kullanılır.",
   rule_en="Some verbs take -ing (enjoy, avoid, finish, mind); others take to + verb (want, decide, hope, need). Use 'to + verb' to show purpose.",
   kw=["gerund","mastar","infinitive","-ing to","to + fiil"],
   pats=[r"\b(enjoy|avoid|finish|mind|suggest|consider|keep|practice|admit|deny)\s+[a-z]+ing\b",
         r"\b(want|wants|wanted|need|decide|decided|hope|plan|planned|promise|agree|refuse|expect|would like|learn|manage)\s+to\s+[a-z]+\b",
         r"\bin order to\s+[a-z]+\b"]),

 dict(id="there_be", tr="There is / There are", en="There is / There are", cefr="A1", azar="Böl. 6",
   formula="There is + tekil  •  There are + çoğul",
   rule_tr="Bir şeyin var olduğunu söyler. Tekil/sayılamayan için 'there is', çoğul için 'there are'. Cümledeki İLK özne fiilin tekil/çoğul olmasını belirler.",
   rule_en="States that something exists. 'there is' for singular/uncountable, 'there are' for plural. The FIRST subject decides the verb.",
   kw=["there is","there are","var","özne yüklem uyumu","subject verb agreement"],
   pats=[r"\bthere\s+(is|are|was|were|will be|has been|have been)\b"]),

 dict(id="quantifiers", tr="Miktar Belirteçleri (Quantifiers)", en="Quantifiers", cefr="A2", azar="Böl. 7",
   formula="some / any / much / many / (a) few / (a) little / a lot of",
   rule_tr="Miktar bildirir. Sayılabilenlerle many / (a) few; sayılamayanlarla much / (a) little; her ikisiyle some, any, a lot of kullanılır. some olumlu, any olumsuz ve sorularda tercih edilir.",
   rule_en="Show quantity. Countable: many / (a) few; uncountable: much / (a) little; both: some, any, a lot of. 'some' in positives, 'any' in negatives/questions.",
   kw=["quantifier","miktar","some any","much many","few little","sayılabilen sayılamayan"],
   pats=[r"\b(some|any|much|many|a few|few|a little|little|a lot of|lots of|several|enough|plenty of)\b"]),

 dict(id="reported_speech", tr="Dolaylı Anlatım (Reported Speech)", en="Reported Speech", cefr="B1-B2", azar="Böl. 12 (12-7)",
   formula="told/said (that) ...  •  asked if/whether ...",
   rule_tr="Bir sözü aktarırken kullanılır. Aktarırken zaman bir adım geriye kayar (present→past). Emir için tell + to + fiil; soru için ask + if/whether kullanılır.",
   rule_en="Report someone's words. Tense usually shifts back one step (present→past). Commands: tell + to + verb; questions: ask + if/whether.",
   kw=["dolaylı anlatım","reported speech","indirect speech","told said asked","aktarım"],
   pats=[r"\b(told|said)\s+(me|him|her|them|us|that)\b", r"\basked\s+(me|him|her|them|us)?\s*(if|whether)\b",
         r"\bsaid\s+that\b"]),

 dict(id="used_to", tr="Used to / Eskiden", en="Used to", cefr="A2-B1", azar="Böl. 2",
   formula="used to + V1",
   rule_tr="Geçmişte olan ama artık olmayan alışkanlık veya durumları anlatır ('eskiden ...-ırdı'). Olumsuz/soruda: didn't use to / did ... use to.",
   rule_en="Past habits or states that are no longer true. Negative/question: didn't use to / did ... use to.",
   kw=["used to","eskiden","geçmiş alışkanlık"],
   pats=[r"\bused\s+to\s+[a-z]+\b", r"\bdidn't use to\b"]),

 dict(id="tag_questions", tr="Eklenti Soruları (Tag Questions)", en="Tag Questions", cefr="B1", azar="Böl. -",
   formula="olumlu cümle, olumsuz tag?  /  olumsuz cümle, olumlu tag?",
   rule_tr="Cümlenin sonuna eklenen küçük sorulardır ('...değil mi?'). Olumlu cümleye olumsuz, olumsuz cümleye olumlu ek gelir; yardımcı fiil ve özne tekrarlanır.",
   rule_en="Short questions added to the end ('...isn't it?'). Positive sentence takes a negative tag and vice versa; repeat the auxiliary and subject.",
   kw=["tag question","eklenti soru","değil mi","isn't it"],
   pats=[r",\s*(isn't|aren't|wasn't|weren't|don't|doesn't|didn't|won't|can't|couldn't|wouldn't|shouldn't|haven't|hasn't|hadn't|is|are|do|does|did|will|can)\s+(it|he|she|they|you|we|i)\s*\?"]),

 dict(id="imperatives", tr="Emir Cümleleri (Imperatives)", en="Imperatives", cefr="A1", azar="Böl. -",
   formula="V1 ...  •  Don't + V1 ...  •  Let's + V1",
   rule_tr="Emir, rica, talimat ve uyarı vermek için kullanılır. Özne (you) söylenmez, fiilin yalın hali (V1) ile başlar. Olumsuzu 'Don't + fiil' ile; birlikte öneri 'Let's + fiil' ile kurulur.",
   rule_en="Used for orders, requests, instructions and warnings. No subject; starts with the base verb (V1). Negative: 'Don't + verb'. Suggestions: 'Let's + verb'.",
   kw=["emir","imperative","emir cümlesi","don't","let's","talimat","rica"],
   pats=[r"^\s*(please\s+)?(don't|do not)\s+[a-z]+\b", r"^\s*let's\s+[a-z]+\b",
         r"^\s*(go|come|stop|wait|look|listen|sit|stand|take|give|open|close|turn|be|keep|let|put|bring|call|try|help|make|read|write|do)\b.*!$"]),

 dict(id="causatives", tr="Ettirgen Yapı (Causatives)", en="Causatives", cefr="B1-B2", azar="Böl. -",
   formula="have/get + nesne + V3   •   have/make/let + kişi + V1",
   rule_tr="Bir işi başkasına yaptırmayı anlatır. 'have/get + nesne + V3' bir hizmeti başkasına yaptırmak içindir (arabayı tamir ettirdim). 'have/make/let + kişi + V1' birine bir şey yaptırmak/izin vermek içindir.",
   rule_en="Expresses causing someone else to do something. 'have/get + object + V3' = arrange a service (I had my car repaired). 'have/make/let + person + V1' = cause/allow someone to act.",
   kw=["ettirgen","causative","yaptırmak","have something done","get something done","make let"],
   pats=[r"\b(have|has|had|get|got|gets)\s+(my|your|his|her|its|our|their|the|a|an|it|them)\s+\w+\s+"+PART+r"\b",
         r"\b(make|makes|made|let|lets|have|has|had|help|helps|helped)\s+(me|you|him|her|us|them|\w+)\s+(V1|[a-z]+)\b",
         r"\b(get|got)\s+\w+\s+to\s+[a-z]+\b"]),

 dict(id="too_enough", tr="Too / Enough", en="Too / Enough", cefr="A2-B1", azar="Böl. -",
   formula="too + sıfat (+to)  •  sıfat + enough (+to)  •  enough + isim",
   rule_tr="'too' (çok/fazla) olumsuz bir aşırılık bildirir: too hot = kalkışamayacak kadar sıcak. 'enough' (yeterince) yeterliliği bildirir; sıfattan SONRA, isimden ÖNCE gelir.",
   rule_en="'too' means excessively (negative): too hot to drink. 'enough' means sufficiently; it follows adjectives but precedes nouns.",
   kw=["too enough","çok fazla","yeterince","too to","enough to"],
   pats=[r"\btoo\s+[a-z]+\s+to\s+[a-z]+\b", r"\b[a-z]+\s+enough\s+to\s+[a-z]+\b",
         r"\btoo\s+(much|many|hot|cold|late|early|big|small|hard|difficult|tired|young|old)\b",
         r"\benough\s+(money|time|food|space|room|people)\b"]),

 dict(id="so_such", tr="So / Such (... that)", en="So / Such ... that", cefr="B1", azar="Böl. -",
   formula="so + sıfat/zarf + that  •  such (a/an) + (sıfat) isim + that",
   rule_tr="Bir sonuç bildiren vurgu yapılarıdır. 'so' sıfat/zarfla kullanılır (so tired that...), 'such' isim öbeğiyle kullanılır (such a good film that...). 'that' ile sonuç cümlesine bağlanır.",
   rule_en="Emphasis structures expressing result. 'so' goes with adjectives/adverbs (so tired that...), 'such' with noun phrases (such a good film that...), linked by 'that'.",
   kw=["so such","so that","such that","o kadar ki","öyle ki"],
   pats=[r"\bso\s+[a-z]+\s+that\b", r"\bsuch\s+(a|an)\s+[a-z]+\s+[a-z]+\s+that\b",
         r"\bsuch\s+(a|an)?\s*[a-z]+.*\bthat\b", r"\bso\s+(much|many|few|little)\b"]),

 dict(id="articles", tr="Tanımlıklar (a / an / the)", en="Articles", cefr="A1-A2", azar="Böl. -",
   formula="a/an + tekil sayılabilir (belirsiz)  •  the (belirli)  •  (sıfır tanımlık)",
   rule_tr="'a/an' ilk kez bahsedilen, herhangi bir tekil sayılabilir isimle kullanılır (a/an sesli harften önce). 'the' hem konuşanın hem dinleyenin bildiği belirli bir şeyle kullanılır. Genel çoğul ve soyut isimlerde tanımlık kullanılmaz.",
   rule_en="'a/an' introduces a singular countable noun mentioned for the first time (an before vowel sounds). 'the' refers to something specific known to both speakers. No article with general plurals/uncountables.",
   kw=["tanımlık","article","a an the","belirli belirsiz"],
   pats=[r"\ban?\s+[a-z]+\b", r"\bthe\s+[a-z]+\b"], prio=1),

 dict(id="prepositions", tr="Edatlar (in / on / at)", en="Prepositions of Time & Place", cefr="A1-A2", azar="Böl. -",
   formula="at (nokta)  •  on (yüzey/gün)  •  in (kapalı alan/ay-yıl)",
   rule_tr="Zaman ve yer edatları. Zamanda: 'at' saat için, 'on' gün/tarih için, 'in' ay/yıl/mevsim için. Yerde: 'at' nokta için, 'on' yüzey için, 'in' kapalı alan için kullanılır.",
   rule_en="Prepositions of time and place. Time: 'at' for clock times, 'on' for days/dates, 'in' for months/years/seasons. Place: 'at' for points, 'on' for surfaces, 'in' for enclosed areas.",
   kw=["edat","preposition","in on at","zaman edatı","yer edatı"],
   pats=[r"\b(at)\s+(\d{1,2}(:\d{2})?|noon|night|midnight|the\s+moment)\b",
         r"\b(on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|the\s+\d)",
         r"\b(in)\s+(january|february|march|april|may|june|july|august|september|october|november|december|\d{4}|the\s+(morning|afternoon|evening))\b"], prio=1),

 dict(id="would_rather", tr="Tercih Yapıları (would rather / prefer / had better)", en="Preference & Advice", cefr="B1-B2", azar="Böl. -",
   formula="would rather + V1  •  prefer + isim/-ing  •  had better + V1",
   rule_tr="Tercih ve tavsiye bildirir. 'would rather + fiil' bir şeyi diğerine tercih etmeyi (yerine ...-erdim), 'prefer' genel tercihi, 'had better + fiil' güçlü tavsiye/uyarıyı (...-sen iyi olur) anlatır.",
   rule_en="Expresses preference and advice. 'would rather + verb' = prefer one thing over another, 'prefer' = general preference, 'had better + verb' = strong advice/warning.",
   kw=["would rather","prefer","had better","tercih","tavsiye","yeğlemek"],
   pats=[r"\bwould\s+rather\s+[a-z]+\b", r"\b'd\s+rather\b",
         r"\b(prefer|prefers|preferred)\s+", r"\bhad\s+better\s+[a-z]+\b", r"\b'd\s+better\b"]),

 dict(id="question_forms", tr="Soru Yapıları (Wh- / Yes-No)", en="Question Forms", cefr="A1-A2", azar="Böl. -",
   formula="(Wh-) + yardımcı fiil + özne + V1 ?",
   rule_tr="İngilizcede soru, yardımcı fiili öznenin önüne alarak kurulur. Evet/hayır soruları yardımcı fiille başlar (Do you...? Is she...?). Bilgi soruları wh- kelimesiyle başlar (What, Where, When, Who, Why, How).",
   rule_en="Questions invert the auxiliary and subject. Yes/no questions start with an auxiliary (Do you...? Is she...?). Information questions start with a wh-word (What, Where, When, Who, Why, How).",
   kw=["soru","question","wh soru","evet hayır sorusu","what where when"],
   pats=[r"^\s*(what|where|when|who|whom|whose|why|how|which)\b.*\?",
         r"^\s*(do|does|did|is|are|am|was|were|have|has|had|can|could|will|would|should|may|might|must)\b.*\?"], prio=1),
]

# ---- ornek secimi icin GUCLU (yapisal) desenler ----
# Detektor tum "pats"i kullanir; ornekler sadece bu yapisal desenlere uyan cumlelerden secilir.
STRONG = {
 "present_simple": [r"\b(always|usually|often|sometimes|rarely|seldom|every day|every week)\b", r"\b(don't|doesn't)\b"],
 "present_perfect": [r"\b(has|have)\s+(not\s+|never\s+|already\s+|just\s+|ever\s+)?"+PART+r"\b", r"\b(has|have)\s+\w+\s+"+PART+r"\b", r"\b(hasn't|haven't)\s+"+PART+r"\b"],
 "past_perfect": [r"\bhad\s+(not\s+|already\s+|never\s+|just\s+)?"+PART+r"\b", r"\bhadn't\s+"+PART+r"\b"],
 "passive": [r"\b(is|are|was|were|been|being|am)\s+(not\s+)?"+PART+r"\s+by\b", r"\b(was|were|is|are)\s+(not\s+)?"+PART+r"\b"],
 "conditionals": [r"\bif\b.*\b(will|would|could|might|had|were|'d)\b", r"\bwould\s+have\s+"+PART+r"\b"],
 "future": [r"\b(will|shall)\s+(not\s+)?[a-z]+\b", r"\bwon't\b", r"\b(is|are|am)\s+going\s+to\s+[a-z]+\b"],
 "modals": [r"\b(can|can't|cannot|could|couldn't|may|might|must|mustn't|should|shouldn't|ought\s+to|had\s+better)\b", r"\b(have|has|had)\s+to\s+[a-z]+\b"],
 "so_such": [r"\bso\s+[a-z]+\s+that\b", r"\bsuch\s+(a|an)\s+([a-z]+\s+)?[a-z]+\s+that\b"],
 "past_simple": [r"\b(yesterday|ago)\b", r"\bdidn't\b",
                 r"\b(went|saw|came|took|made|got|said|found|gave|told|knew|thought|left|felt|bought|brought)\b"],
}

# eslesme esitliginde daha "ogretici/spesifik" yapiyi one al
PRIORITY_HIGH = {"passive","conditionals","present_perfect","past_perfect","present_perfect_prog",
                 "relative_clauses","noun_clauses","adverb_clauses","wish","reported_speech","gerund_infinitive",
                 "causatives","so_such","would_rather","too_enough"}
PRIORITY_LOW  = {"present_simple","past_simple","articles","prepositions","question_forms"}
def prio_of(tid):
    if tid in PRIORITY_HIGH: return 3
    if tid in PRIORITY_LOW:  return 1
    return 2

# ---- yardimci: cumle temizleme ----
def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip())

def load_pairs():
    data = json.load(io.open(UP, encoding="utf-8"))
    clean, seen = [], set()
    stats = dict(total=len(data), malformed=0, empty=0, dup=0, kept=0, missing_tr=0)
    for it in data:
        if not isinstance(it, dict):
            stats["malformed"] += 1; continue
        keys = set(it.keys())
        if "ingilizce" not in keys:
            stats["malformed"] += 1; continue
        en = norm(it.get("ingilizce"))
        tr = norm(it.get("türkçe"))
        if not en:
            stats["empty"] += 1; continue
        if not tr:
            stats["missing_tr"] += 1; continue
        key = en.lower()
        if key in seen:
            stats["dup"] += 1; continue
        seen.add(key)
        wc = len(en.split())
        if wc == 0 or wc > 30:
            stats["empty"] += 1; continue
        clean.append(dict(en=en, tr=tr, len=wc))
        stats["kept"] += 1
    return clean, stats

# ---- etiketleme ----
def compile_topics():
    for t in TOPICS:
        t["_rx"] = [re.compile(p, re.I) for p in t["pats"]]
        t["_rxs"] = [re.compile(p, re.I) for p in STRONG.get(t["id"], t["pats"])]
    return TOPICS

def topics_for(en, topics):
    hits = []
    for t in topics:
        score = sum(1 for rx in t["_rx"] if rx.search(en))
        if score:
            hits.append((t["id"], score))
    hits.sort(key=lambda x: -x[1])
    return hits

JUNK = re.compile(r"\(en |günlük\)|Düşüşte|Sam bir paket|©|http|\d\.\d|İki nesne", re.I)
def quality_ok(p):
    en, tr = p["en"], p["tr"]
    if not re.match(r"^[A-Z].*[.?!]$", en): return False   # gercek, tam cumle
    if not (4 <= p["len"] <= 16): return False
    if len(tr) < 4 or JUNK.search(tr): return False        # bozuk/sablon Turkce ele
    return True

def pick_examples(matched, n=6):
    # cesitli uzunlukta cumleleri sec (kisa -> uzun yayilim)
    good = sorted(matched, key=lambda m: m["len"])
    if len(good) <= n:
        chosen = good
    else:
        step = len(good) / n
        chosen, seen = [], set()
        for i in range(n):
            m = good[int(i*step)]
            if m["en"] in seen:  # cakisma olursa sonrakini al
                for m2 in good:
                    if m2["en"] not in seen:
                        m = m2; break
            seen.add(m["en"]); chosen.append(m)
    return [dict(en=m["en"], tr=m["tr"]) for m in chosen]

def main():
    pairs, stats = load_pairs()
    topics = compile_topics()
    counts = {t["id"]: 0 for t in topics}          # etiket sayaci (istatistik)
    ex_pool = {t["id"]: [] for t in topics}        # ornek havuzu (yapisal + kaliteli)
    tagged = []
    for p in pairs:
        hits = topics_for(p["en"], topics)
        ids = [h[0] for h in hits[:3]]
        if ids:
            tagged.append(dict(en=p["en"], tr=p["tr"], topics=ids, len=p["len"]))
        for tid in ids:
            counts[tid] += 1
        # ornek havuzu: sadece GUCLU yapisal desene uyan ve kaliteli cumleler
        if quality_ok(p):
            for t in topics:
                if any(rx.search(p["en"]) for rx in t["_rxs"]):
                    ex_pool[t["id"]].append(p)

    kb_topics = []
    for t in topics:
        ex = pick_examples(ex_pool[t["id"]], 8)
        kb_topics.append(dict(
            id=t["id"], title_tr=t["tr"], title_en=t["en"], cefr=t["cefr"],
            azar_ref=t["azar"], formula=t["formula"],
            rule_tr=t["rule_tr"], rule_en=t["rule_en"],
            keywords=t["kw"], patterns=t["pats"], priority=prio_of(t["id"]),
            match_count=counts[t["id"]], examples=ex))

    kb = dict(
        meta=dict(
            title="Dil Haritası – Öğretmen Destek Bilgi Tabanı",
            generated=datetime.date.today().isoformat(),
            topic_count=len(kb_topics),
            source_sentences=stats["kept"],
            note="Kural metinleri özgün olarak yazılmıştır; örnek cümleler excelveri.json havuzundan seçilmiştir."),
        topics=kb_topics)

    io.open(OUT+"teacher-kb.json","w",encoding="utf-8").write(json.dumps(kb, ensure_ascii=False, indent=2))
    io.open(OUT+"teacher-kb.js","w",encoding="utf-8").write(
        "// Otomatik üretildi – tarayıcıda <script src> ile gömmek için.\n"
        "window.TEACHER_KB = " + json.dumps(kb, ensure_ascii=False) + ";\n")
    io.open(OUT+"sentences.tagged.json","w",encoding="utf-8").write(json.dumps(tagged, ensure_ascii=False))

    # rapor
    print("=== TEMIZLEME ===")
    for k,v in stats.items(): print(f"  {k:12s}: {v}")
    print("=== ETIKETLENEN CUMLE ===", len(tagged))
    print("=== KONU BASINA ESLESME ===")
    for t in kb_topics:
        print(f"  {t['id']:22s} eşleşme={t['match_count']:5d}  örnek={len(t['examples'])}")
    print("=== ORNEK KART (present_perfect) ===")
    pp = next(t for t in kb_topics if t["id"]=="present_perfect")
    for e in pp["examples"]:
        print("   -", e["en"], "|", e["tr"])

if __name__ == "__main__":
    main()
