import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { Bcrypt } from '../../auth/bcrypt/bcrypt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ImageKitService } from './imagekit.service';

@Injectable()
export class UsuarioService {
  constructor(
    @InjectRepository(Usuario)
    private usuarioRepository: Repository<Usuario>,
    private bcrypt: Bcrypt,
    private configService: ConfigService,
    private httpService: HttpService,
    private imagekitService: ImageKitService,
  ) {}

  async findByUsuario(usuario: string): Promise<Usuario | undefined> {
    return await this.usuarioRepository.findOne({
      where: {
        usuario: usuario,
      },
    });
  }

  async findAll(): Promise<Usuario[]> {
    return await this.usuarioRepository.find({
      relations: {
        postagem: true,
      },
    });
  }

  async findById(id: number): Promise<Usuario> {
    let usuario = await this.usuarioRepository.findOne({
      where: {
        id,
      },
      relations: {
        postagem: true,
      },
    });

    if (!usuario)
      throw new HttpException('Usuario não encontrado!', HttpStatus.NOT_FOUND);

    return usuario;
  }

  async create(usuario: Usuario, image?: Express.Multer.File): Promise<Usuario> {

    if (await this.findByUsuario(usuario.usuario)) {
      throw new HttpException('O Usuario ja existe!', HttpStatus.BAD_REQUEST);
    }

    usuario.senha = await this.bcrypt.criptografarSenha(usuario.senha);

    const saveUser = await this.usuarioRepository.save(usuario)

    const fotoUrl = await this.imagekitService.handleImage(image || usuario.foto, saveUser.id);

    if (fotoUrl) {
      saveUser.foto = fotoUrl;
    }

    await this.usuarioRepository.update(saveUser.id, saveUser);

    return this.findById(usuario.id);

  }

  async update(usuario: Usuario, image?: Express.Multer.File): Promise<Usuario> {

    const usuarioDatabase = await this.findById(usuario.id);
    const buscaUsuario = await this.findByUsuario(usuario.usuario);
    
    if (buscaUsuario && usuarioDatabase.id.toString() !== usuario.id.toString()) {
      throw new HttpException('Usuário (e-mail) já Cadastrado!', HttpStatus.BAD_REQUEST);
    }

    const fotoUrl = await this.imagekitService.handleImage(
      image || usuario.foto,
      usuario.id,
      usuarioDatabase.foto
    );
    
    if (fotoUrl) usuario.foto = fotoUrl;
    
    usuario.senha = await this.bcrypt.criptografarSenha(usuario.senha);

    await this.usuarioRepository.update(usuario.id, usuario);

    return this.findById(usuario.id);
  }
}
