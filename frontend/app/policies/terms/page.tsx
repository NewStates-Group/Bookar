export default function TermsPage() {
    return (
        <main className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-6 py-20">
                <h1 className="text-4xl font-bold mb-8">Termos de Uso</h1>

                <p className="text-gray-600 mb-8">
                    Última atualização: 04 de junho de 2026
                </p>

                <div className="space-y-8 text-gray-700 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            1. Aceitação dos Termos
                        </h2>
                        <p>
                            Ao acessar ou utilizar a plataforma Bookar, você concorda com
                            estes Termos de Uso. Caso não concorde com qualquer parte destes
                            termos, não utilize nossos serviços.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            2. Sobre a Plataforma
                        </h2>
                        <p>
                            A Bookar é uma plataforma educacional que oferece cursos,
                            conteúdos digitais, ferramentas de aprendizagem e recursos
                            baseados em inteligência artificial para auxiliar estudantes e
                            profissionais no desenvolvimento de competências.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            3. Criação de Conta
                        </h2>
                        <p>
                            Para acessar determinadas funcionalidades, poderá ser necessário
                            criar uma conta utilizando e-mail ou serviços de autenticação de
                            terceiros, como Google.
                        </p>

                        <p className="mt-3">
                            Você é responsável por manter a confidencialidade das suas
                            credenciais e pelas atividades realizadas através da sua conta.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            4. Uso Permitido
                        </h2>

                        <p>Você concorda em não:</p>

                        <ul className="list-disc pl-6 mt-3 space-y-2">
                            <li>Utilizar a plataforma para atividades ilegais.</li>
                            <li>Tentar acessar áreas restritas sem autorização.</li>
                            <li>Distribuir malware ou conteúdo malicioso.</li>
                            <li>Violar direitos de propriedade intelectual.</li>
                            <li>Interferir no funcionamento da plataforma.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            5. Conteúdo e Propriedade Intelectual
                        </h2>

                        <p>
                            Todo o conteúdo disponibilizado pela Bookar, incluindo textos,
                            design, logótipos, interfaces, funcionalidades, cursos e
                            materiais educativos, é protegido por direitos autorais e outras
                            leis aplicáveis.
                        </p>

                        <p className="mt-3">
                            Nenhum conteúdo poderá ser copiado, reproduzido ou distribuído sem
                            autorização prévia.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            6. Inteligência Artificial
                        </h2>

                        <p>
                            Algumas funcionalidades utilizam inteligência artificial para
                            gerar explicações, resumos, recomendações e outros conteúdos.
                        </p>

                        <p className="mt-3">
                            Embora busquemos fornecer informações úteis e precisas, não
                            garantimos que todo conteúdo gerado seja livre de erros ou
                            adequado para todas as situações.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            7. Suspensão ou Encerramento de Contas
                        </h2>

                        <p>
                            Reservamo-nos o direito de suspender ou encerrar contas que
                            violem estes Termos de Uso ou que representem risco para a
                            segurança da plataforma e dos seus utilizadores.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            8. Limitação de Responsabilidade
                        </h2>

                        <p>
                            A Bookar é fornecida "como está". Não garantimos disponibilidade
                            contínua, ausência de interrupções ou adequação para objetivos
                            específicos.
                        </p>

                        <p className="mt-3">
                            Na máxima extensão permitida pela legislação aplicável, a Bookar
                            não será responsável por perdas indiretas, danos consequenciais ou
                            prejuízos decorrentes do uso da plataforma.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            9. Alterações dos Termos
                        </h2>

                        <p>
                            Podemos atualizar estes Termos de Uso periodicamente. As alterações
                            entrarão em vigor após sua publicação nesta página.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            10. Contacto
                        </h2>

                        <p>
                            Caso tenha dúvidas sobre estes Termos de Uso, entre em contacto:
                        </p>

                        <div className="mt-4 rounded-xl border p-4 bg-gray-50">
                            <p>
                                <strong>Bookar</strong>
                            </p>
                            <p>Email: suporte@bookar.study</p>
                            <p>Website: https://bookar.study</p>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}